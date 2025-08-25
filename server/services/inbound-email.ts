import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { storage } from '../storage';
import { sendThreadedReply } from './mailgun-threaded';
import { callOpenRouterJSON } from './call-openrouter';


// Basic safeguards
const REPLY_RATE_LIMIT_MINUTES = parseInt(process.env.AI_REPLY_RATE_LIMIT_MINUTES || '15', 10);
function sanitizeHtmlBasic(html: string): string {
  if (!html) return '';
  let out = html;
  // Strip script/style and active embeds
  out = out.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<(?:iframe|object|embed)[^>]*>[\s\S]*?<\/(?:iframe|object|embed)>/gi, '');
  // Remove inline event handlers like onclick, onload
  out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  // Neutralize javascript: URLs
  out = out.replace(/(href|src)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, '$1="#"');
  return out;
}

interface MailgunInboundEvent {
  sender: string;
  recipient: string;
  subject: string;
  'body-plain': string;
  'body-html': string;
  'stripped-text': string;
  'stripped-html': string;
  'message-headers': string;
  'content-id-map': string;
  timestamp: number;
  token: string;
  signature: string;
}

export class InboundEmailService {
  /**
   * Handle incoming email responses from leads
   * This webhook endpoint processes Mailgun inbound emails
   */
  static async handleInboundEmail(req: Request, res: Response) {
    try {
      const event: MailgunInboundEvent = (req.headers['content-type'] || '').includes('application/json')
        ? req.body
        : (Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as any);

      // Verify Mailgun webhook signature
      if (!this.verifyMailgunSignature(event)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const REQUIRE_CAMPAIGN = String(process.env.INBOUND_REQUIRE_CAMPAIGN_REPLY || 'true').toLowerCase() !== 'false';
      const recipient = (event.recipient || '').toLowerCase();
      const match = recipient.match(/campaign-([a-z0-9-]+)@/i);
      const ACCEPT_SUFFIX = (process.env.INBOUND_ACCEPT_DOMAIN_SUFFIX || 'offerlogix.me').toLowerCase();
      const recipientDomain = recipient.split('@')[1] || '';
      const ACCEPT_BY_DOMAIN = recipientDomain.endsWith(ACCEPT_SUFFIX);

      // If strict mode is on, only process replies to a campaign address unless recipient domain is allowed
      if (REQUIRE_CAMPAIGN && !match && !ACCEPT_BY_DOMAIN) {
        return res.status(200).json({ message: 'Ignored: not a campaign reply' });
      }

      let leadInfo: { leadId: string; lead: any } | null = null;
      let campaignId: string | undefined;
      if (match) {
        campaignId = match[1];
        // Verify campaign exists and sender is a lead on it
        const campaign = await storage.getCampaign(campaignId);
        if (!campaign) {
          return res.status(200).json({ message: 'Ignored: unknown campaign' });
        }
        const leads = await storage.getLeadsByCampaign(campaignId);
        const senderEmail = (event.sender || '').toLowerCase();
        const matchingLead = leads.find(l => (l.email || '').toLowerCase() === senderEmail);
        if (!matchingLead) {
          return res.status(200).json({ message: 'Ignored: sender not a lead on campaign' });
        }
        leadInfo = { leadId: matchingLead.id, lead: matchingLead };
      } else {
        // Legacy: try to resolve lead without campaign binding (only if allowed)
        leadInfo = await this.extractLeadFromEmail(event);
      }

      // Accept any recipient in allowed domain suffix; auto-create lead if missing
      if (!leadInfo && ACCEPT_BY_DOMAIN) {
        const senderEmail = (event.sender || '').toLowerCase();
        let lead = await storage.getLeadByEmail(senderEmail);
        if (!lead) {
          lead = await storage.createLead({ email: senderEmail, leadSource: 'email_inbound', status: 'new' } as any);
        }
        leadInfo = { leadId: (lead as any).id, lead } as any;
      }

      if (!leadInfo) {
        console.log('Could not identify lead from email:', event.sender);
        return res.status(200).json({ message: 'Email processed but lead not identified' });
      }

      // Create or update conversation bound to campaign if available
      const conversation = await this.getOrCreateConversation(leadInfo.leadId, event.subject, campaignId);

      // Save the email as a conversation message
      await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: null, // Lead replies don't have a user ID
        messageType: 'email',
        content: event['stripped-text'] || event['body-plain'],
        isFromAI: 0
      });

      // Call AI JSON loop with last N messages
      const recentMessages = await storage.getConversationMessages(conversation.id, 10);

      // Guard: block only consecutive AI replies within cooldown; never block after a lead message
      const now = Date.now();
      const lastMsg = recentMessages[recentMessages.length - 1];
      if (lastMsg && lastMsg.isFromAI && (now - new Date((lastMsg as any).createdAt).getTime()) < REPLY_RATE_LIMIT_MINUTES * 60 * 1000) {
        console.log(`[AI Reply Guard] Skipping consecutive AI reply (cooldown ${REPLY_RATE_LIMIT_MINUTES}m)`);
        return res.status(200).json({ message: 'Rate-limited; no consecutive AI reply' });
      }

      const systemPrompt = `### Core Identity
You are a member of the OfferLogix team, reaching out to dealerships and technology partners.  
Your job is to clearly explain what we do, how we solve problems, and why it matters — without fluff, jargon, or over-the-top sales language.  
Think of yourself as a straight-talking teammate who knows the product, knows the industry, and values people's time.  

### Communication Style
- **Be real.** Conversational, approachable, clear — never robotic.  
- **Be direct.** Say what matters in plain language. Short sentences. Easy to skim.  
- **Be value-focused.** Always tie back to what helps the dealership/vendor: save time, boost leads, simplify compliance, streamline payment advertising.  
- **Be respectful.** Decision-makers are busy — you get to the point without hype.  
- **Be collaborative.** Frame messages like: "Here's what we can do for you if it's a fit."  

### Rules of Engagement
1. **Start with context.** One‑liner on what's relevant to them.  
2. **Point out the benefit.** How OfferLogix makes their life easier, faster, or safer.  
3. **Ask one clear next question.** No long surveys, no multiple asks at once.  
4. **Keep it light but professional.** Sound like a competent peer, not a telemarketer.  
5. **Always respect opt‑out / handover.** If they're not interested, acknowledge and move on.  

### What NOT to Do
- ❌ Don't write like a press release ("industry-leading, cutting-edge…")  
- ❌ Don't overload with technical terms (keep compliance/API/payment details simple).  
- ❌ Don't over-hype ("This will revolutionize your…").  
- ❌ Don't bury the ask in long paragraphs.  

### Prime Directive
Sound like a **real OfferLogix teammate** having a straight conversation with a busy dealership/vendor contact.  
- Keep it human.  
- Keep it clear.  
- Always tie back to value.  
- Guide toward either engagement or graceful exit.  

Output strictly JSON only with keys: should_reply (boolean), handover (boolean), reply_subject (string), reply_body_html (string), rationale (string).`;
      const aiResult = await callOpenRouterJSON<{ should_reply: boolean; handover: boolean; reply_subject?: string; reply_body_html?: string; rationale?: string }>({
        model: 'openai/gpt-5-mini',
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Latest inbound email from ${event.sender}:\n${event['stripped-text'] || event['body-plain'] || ''}\n\nLast messages:\n${recentMessages.map(m => (m.isFromAI ? 'AI: ' : 'Lead: ') + (m.content || '')).join('\n').slice(0, 4000)}` }
        ],
        temperature: 0.2,
        maxTokens: 800,
      });

      // Sanitize reply HTML and log rationale
      const safeHtml = sanitizeHtmlBasic(aiResult.reply_body_html || '');
      console.log('[AI Reply Decision]', {
        conversationId: conversation.id,
        should_reply: aiResult.should_reply,
        handover: aiResult.handover,
        rationale: aiResult.rationale?.slice(0, 300)
      });


      // Decision: reply vs handover
      if (aiResult?.handover || !aiResult?.should_reply) {
        await storage.createHandover({ conversationId: conversation.id, reason: aiResult?.rationale || 'AI requested handover' });
        return res.status(200).json({ message: 'Handover created' });
      }

      // Send reply via Mailgun with threading
      const headers = JSON.parse(event['message-headers'] || '[]') as Array<[string, string]>;
      const messageId = headers.find(h => h[0].toLowerCase() === 'message-id')?.[1]?.replace(/[<>]/g, '') || undefined;
      await sendThreadedReply({
        to: event.sender,
        subject: aiResult.reply_subject || `Re: ${event.subject || 'Your email'}`,
        html: aiResult.reply_body_html || '',
        inReplyTo: messageId ? `<${messageId}>` : undefined,
        references: messageId ? [ `<${messageId}>` ] : undefined,
        domainOverride: (await storage.getActiveAiAgentConfig())?.agentEmailDomain || undefined,
      });

      // Persist AI reply
      await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: null, // AI replies don't have a user ID
        messageType: 'email',
        content: aiResult.reply_body_html || '',
        isFromAI: 1,
      });

      res.status(200).json({ message: 'Email processed and replied' });
    } catch (error) {
      console.error('Inbound email processing error:', error);
      res.status(500).json({ error: 'Failed to process inbound email' });
    }
  }

  /**
   * SMS is de-scoped in outbound-only refactor. Keeping stub for backwards-compat.
   */
  static async handleInboundSMS(req: Request, res: Response) {
    // SMS path is disabled in outbound-only mode
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }

  private static verifyMailgunSignature(event: MailgunInboundEvent): boolean {
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

    // Allow explicit test bypass only in non-production if no signing key is set
    if (!signingKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('MAILGUN_WEBHOOK_SIGNING_KEY not set; bypassing signature verification in non-production');
        return !!(event.sender && event.timestamp && event.token);
      }
      console.error('MAILGUN_WEBHOOK_SIGNING_KEY missing in production');
      return false;
    }

    try {
      const hmac = createHmac('sha256', signingKey)
        .update(String(event.timestamp) + String(event.token))
        .digest('hex');
      return hmac === event.signature;
    } catch (err) {
      console.error('Signature verification error:', err);
      return false;
    }
  }

  private static async extractLeadFromEmail(event: MailgunInboundEvent) {
    // Try to find lead by email address
    const lead = await storage.getLeadByEmail(event.sender);
    if (lead) {
      return { leadId: lead.id, lead };
    }

    // Extract campaign tracking info from recipient or subject
    const trackingMatch = event.recipient.match(/campaign-([a-zA-Z0-9-]+)@/);
    if (trackingMatch) {
      const campaignId = trackingMatch[1];
      // Find lead associated with this campaign
      const leads = await storage.getLeadsByCampaign(campaignId);
      const matchingLead = leads.find(l => l.email === event.sender);
      if (matchingLead) {
        return { leadId: matchingLead.id, lead: matchingLead };
      }
    }

    return null;
  }

  private static async getOrCreateConversation(leadId: string, subject: string, campaignId?: string) {
    // Try to find existing conversation for this lead
    const conversations = await storage.getConversationsByLead(leadId);

    if (conversations.length > 0) {
      // Return most recent conversation
      return conversations[0];
    }

    // Create new conversation (bind to campaign if provided)
    return await storage.createConversation({
      leadId,
      campaignId,
      subject: subject || 'Email Conversation',
      status: 'active'
    } as any);
  }

  // Legacy auto-response is deprecated. Kept for reference but unused.
  private static async shouldGenerateAutoResponse(lead: any, conversation: any): Promise<boolean> {
    // Check business hours
    const now = new Date();
    const hour = now.getHours();
    const isBusinessHours = hour >= 8 && hour <= 18; // 8 AM to 6 PM

    // Always respond during business hours
    if (isBusinessHours) return true;

    // Check if lead has urgent indicators
    const recentMessages = await storage.getConversationMessages(conversation.id, 3);
    const hasUrgentKeywords = recentMessages.some(m =>
      m.content.toLowerCase().includes('urgent') ||
      m.content.toLowerCase().includes('today') ||
      m.content.toLowerCase().includes('asap')
    );

    return hasUrgentKeywords;
  }

  // Legacy generation path removed in outbound-only flow.

  private static getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  // Legacy helper retained for compatibility
  private static extractBrandFromContext(context: any): string | undefined {
    const text = (context.vehicleInterest || '').toLowerCase();
    const brands = ['honda', 'toyota', 'ford', 'chevrolet', 'jeep'];
    return brands.find(brand => text.includes(brand));
  }
}