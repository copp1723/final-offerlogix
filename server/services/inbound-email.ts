import { Request, Response } from 'express';

function extractEmail(addr: string | undefined): string {
  if (!addr) return '';
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim();
}

function extractLocal(recipient: string) {
  const match = recipient.toLowerCase().match(/^[^@]+/);
  return match ? match[0] : '';
}

function tryGetConversationIdFromRecipient(recipient: string): number | null {
  const local = extractLocal(recipient); // e.g., "brittany+conv_12345"
  const m = local.match(/conv_(\d+)/);
  return m ? Number(m[1]) : null;
}
import { createHmac } from 'crypto';
import { storage } from '../storage';
import { sendThreadedReply } from './mailgun-threaded';
import { callOpenRouterJSON } from './call-openrouter';
import { buildErrorResponse, createErrorContext } from '../utils/error-utils';
import { log } from '../logging/logger';
import { ConversationRateLimiters } from './conversation-rate-limiter';


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
  'Message-Id'?: string;
  'message-id'?: string;
  // Allow for other dynamic properties
  [key: string]: any;
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

      // TEMPORARILY DISABLED: Verify Mailgun webhook signature
      // TODO: Fix signature verification for inbound emails
      if (process.env.NODE_ENV === 'production' && !this.verifyMailgunSignature(event)) {
        log.warn('Mailgun signature verification failed - processing anyway for now', {
          component: 'inbound-email',
          operation: 'webhook_signature_verification',
          sender: event.sender,
          recipient: event.recipient,
          hasSignature: !!event.signature,
          hasTimestamp: !!event.timestamp,
          hasToken: !!event.token
        });
        // Temporarily allow processing even with signature failure
        // return res.status(401).json(errorResponse);
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
      let campaign: any | null = null;
      if (match) {
        campaignId = match[1];
        // Verify campaign exists and sender is a lead on it
        campaign = await storage.getCampaign(campaignId);
        if (!campaign) {
          return res.status(200).json({ message: 'Ignored: unknown campaign' });
        }
        const leads = await storage.getLeadsByCampaign(campaignId);
        const senderEmail = extractEmail(event.sender || '').toLowerCase();
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
        const senderEmail = extractEmail(event.sender || '').toLowerCase();
        let lead = await storage.getLeadByEmail(senderEmail);
        if (!lead) {
          lead = await storage.createLead({ email: senderEmail, leadSource: 'email_inbound', status: 'new' } as any);
        }
        leadInfo = { leadId: (lead as any).id, lead } as any;
      }

      if (!leadInfo) {
        log.info('Could not identify lead from email', {
          component: 'inbound-email',
          operation: 'lead_identification',
          sender: event.sender,
          recipient: event.recipient,
          subject: event.subject?.slice(0, 100)
        });
        return res.status(200).json({ message: 'Email processed but lead not identified' });
      }

      // Multi-step conversation lookup with fallbacks
      let conversation: any = null;
      
      // 1) Primary: thread by headers (if we had proper Message-ID extraction)
      // This is handled later in the Message-ID extraction logic
      
      // 2) Fallback A: token in recipient
      const recipientConvId = tryGetConversationIdFromRecipient(event.recipient || '');
      if (recipientConvId) {
        try {
          conversation = await storage.getConversationById(recipientConvId);
          if (conversation) {
            log.info('Conversation found via plus-addressing token', {
              component: 'inbound-email',
              operation: 'conversation_lookup_fallback',
              conversationId: recipientConvId,
              sender: event.sender,
              method: 'plus_addressing'
            });
          }
        } catch (err) {
          log.warn('Failed to get conversation by plus-addressing token', {
            component: 'inbound-email',
            operation: 'conversation_lookup_fallback',
            conversationId: recipientConvId,
            error: (err as any).message
          });
        }
      }
      
      // 3) Fallback B: create or get conversation (original logic)
      if (!conversation) {
        conversation = await this.getOrCreateConversation(leadInfo.leadId, event.subject, campaignId);
      }

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
        log.info('AI Reply Guard: Skipping consecutive AI reply', {
          component: 'inbound-email',
          operation: 'rate_limiting',
          conversationId: conversation.id,
          cooldownMinutes: REPLY_RATE_LIMIT_MINUTES,
          lastAiReplyTime: (lastMsg as any).createdAt,
          sender: event.sender
        });
        return res.status(200).json({ message: 'Rate-limited; no consecutive AI reply' });
      }

      const systemPrompt = `### Core Identity
You are Brittany from the OfferLogix team, reaching out to dealerships and technology partners.  
Your job is to clearly explain what we do, how we solve problems, and why it matters — without fluff, jargon, or over-the-top sales language.  
Think of yourself as a straight-talking teammate who knows the product, knows the industry, and values people's time.

### OfferLogix Company Knowledge
Main Value Proposition: "Advertise Automotive Payments With Confidence"

What We Do: OfferLogix provides penny perfect payment solutions using unique, patented technology to simplify calculating lease and finance payments for any dealer's inventory. Our solutions integrate across all customer touchpoints, advertising precise, compliant payments for every vehicle.

Company Scale:
- $1.5 Billion in accurate payments processed monthly
- 8,000+ dealerships powered in North America  
- 18+ years of experience (US and Canada)

Core Solutions:

1. Payment Calculation Solutions - Patented single-call API that generates dynamic, precise payments with:
   - Regional incentives and rebates
   - Lender affiliations and dealer pricing
   - Daily updates for accuracy
   - Built-in Reg M and Reg Z compliance (all 50 states + Canada)
   - Foundation Package: Basic payment data delivery
   - Premium Package: Automated Offer Manager with daily-updated inventory integration

2. Instant Credit Solutions - Real-time credit processing without impacting consumer credit scores:
   - Soft credit pulls from Equifax (no credit score impact)
   - Real-time credit approvals with live APR from selected banks
   - Credit Perfect Payments using actual credit scores
   - White-labeled customer credit dashboard
   - Elite Package: Lead generation + pre-qualification
   - Premium Package: Full credit approval + real-time APR

Proven Results:
- +16% average engagement rate
- +60% showroom visits
- +134% increase in lead volume

Key Partnerships: Equifax, VinCue, Fullpath, THE SHOP (FordDirect), STELLANTIS

Target Audiences: 
- Dealers: GMs, Finance Managers, Digital Marketing Managers
- Vendors: Technology partners needing payment calculation integration  

### Communication Style
- Be real: Conversational, approachable, clear — never robotic.  
- Be direct: Say what matters in plain language. Short sentences. Easy to skim.  
- Be value-focused: Always tie back to what helps the dealership/vendor: save time, boost leads, simplify compliance, streamline payment advertising.  
- Be respectful: Decision-makers are busy — you get to the point without hype.  
- Be collaborative: Frame messages like: "Here's what we can do for you if it's a fit."  

### Rules of Engagement
1. Start with context: One‑liner on what's relevant to them.  
2. Point out the benefit: How OfferLogix makes their life easier, faster, or safer.  
3. Ask one clear next question: No long surveys, no multiple asks at once.  
4. Keep it light but professional: Sound like a competent peer, not a telemarketer.  
5. Always respect opt‑out / handover: If they're not interested, acknowledge and move on.  

### What NOT to Do
- Don't write like a press release ("industry-leading, cutting-edge…")  
- Don't overload with technical terms (keep compliance/API/payment details simple).  
- Don't over-hype ("This will revolutionize your…").  
- Don't bury the ask in long paragraphs.  

### Prime Directive
Sound like a real OfferLogix teammate having a straight conversation with a busy dealership/vendor contact.  
- Keep it human.  
- Keep it clear.  
- Always tie back to value.  
- Guide toward either engagement or graceful exit.  

### EMAIL FORMATTING REQUIREMENTS
- Write in PLAIN, CONVERSATIONAL text - NO markdown, NO asterisks, NO formatting symbols
- Use HTML paragraph tags (<p></p>) for proper spacing - NO other HTML formatting
- Keep emails concise - 3-4 short paragraphs maximum
- Write like a normal business email, not a formatted document
- NO bold, italic, bullet points, or special characters in the email body
- Professional but friendly tone throughout
- Each paragraph should be wrapped in <p></p> tags for proper spacing
- NO <strong>, <em>, <ul>, <li>, or other formatting tags

EXAMPLE GOOD FORMAT:
<p>Hi [Name],</p>
<p>Thanks for reaching out about OfferLogix payment solutions. We help dealerships advertise precise, compliant payments using our patented technology that processes $1.5 billion monthly across 8,000+ dealerships.</p>
<p>Our Instant Credit Solutions use soft pulls from Equifax to give customers real-time approvals without impacting their credit scores. This typically increases showroom visits by 60% and lead volume by 134%.</p>
<p>Would you be interested in a quick 10-minute call to see how this could work for your dealership?</p>
<p>Best regards,<br>Brittany</p>

Output strictly JSON only with keys: should_reply (boolean), handover (boolean), reply_subject (string), reply_body_html (string), rationale (string).`;
      // Check AI conversation rate limits first
      const rateLimitCheck = ConversationRateLimiters.checkAIResponseAllowed(
        conversation.id, 
        leadInfo?.lead?.email, 
        campaign?.id
      );
      
      if (!rateLimitCheck.allowed) {
        log.info('AI Reply Decision: Rate limited, skipping AI response', {
          conversationId: conversation.id,
          sender: event.sender,
          reason: rateLimitCheck.reason,
          retryAfter: rateLimitCheck.retryAfter,
          component: 'inbound-email',
          operation: 'ai_reply_decision'
        });
        return res.status(200).json({ status: 'rate_limited', message: rateLimitCheck.reason });
      }

      let aiResult: { should_reply: boolean; handover: boolean; reply_subject?: string; reply_body_html?: string; rationale?: string };
      try {
        aiResult = await callOpenRouterJSON({
          model: 'openai/gpt-5-chat',
          system: systemPrompt,
          messages: [
            { role: 'user', content: `Latest inbound email from ${event.sender}:\n${event['stripped-text'] || event['body-plain'] || ''}\n\nLast messages:\n${recentMessages.map(m => (m.isFromAI ? 'AI: ' : 'Lead: ') + (m.content || '')).join('\n').slice(0, 4000)}` }
          ],
          temperature: 0.2,
          maxTokens: 800,
        });
      } catch (err) {
        const errorContext = createErrorContext(err, { 
          conversationId: conversation.id,
          sender: event.sender,
          operation: 'ai_reply_decision'
        });
        log.error('AI Reply Decision: OpenRouter error, falling back to handover', {
          ...errorContext,
          component: 'inbound-email',
          operation: 'ai_reply_decision'
        });
        aiResult = { should_reply: false, handover: true, rationale: 'AI service unavailable' } as any;
      }

      // Sanitize reply HTML and log rationale
      const safeHtml = sanitizeHtmlBasic(aiResult.reply_body_html || '');
      log.info('AI Reply Decision completed', {
        component: 'inbound-email',
        operation: 'ai_reply_decision',
        conversationId: conversation.id,
        should_reply: aiResult.should_reply,
        handover: aiResult.handover,
        rationale: aiResult.rationale?.slice(0, 300),
        sender: event.sender
      });


      // Decision: reply vs handover
      if (aiResult?.handover || !aiResult?.should_reply) {
        await storage.createHandover({ conversationId: conversation.id, reason: aiResult?.rationale || 'AI requested handover' });
        return res.status(200).json({ message: 'Handover created' });
      }

      // Record AI INBOUND response being sent (no conversation-level rate limiting for lead replies)
      ConversationRateLimiters.recordAIInboundResponse(conversation.id, leadInfo?.lead?.email, campaign?.id);

      // Send reply via Mailgun with threading
      try {
        // Extract Message-ID for threading (try multiple approaches)
        let messageId: string | undefined;
        
        // Method 1: Parse message-headers JSON array
        try {
          const headersArr: Array<[string, string]> = JSON.parse(event['message-headers'] || '[]');
          messageId = headersArr.find(h => (h[0] || '').toLowerCase() === 'message-id')?.[1]?.replace(/[<>]/g, '');
        } catch {}
        
        // Method 2: Check if Message-ID is directly in event object
        if (!messageId && event['Message-Id']) {
          messageId = event['Message-Id'].replace(/[<>]/g, '');
        }
        
        // Method 3: Check common variations
        if (!messageId && event['message-id']) {
          messageId = event['message-id'].replace(/[<>]/g, '');
        }
        
        // Method 4: Generate consistent thread ID based on conversation if no Message-ID found
        if (!messageId) {
          // Use conversation ID as basis for threading - scoped to the active Mailgun domain
          const idDomain = (process.env.MAILGUN_DOMAIN || '').split('@').pop()!.trim() || 'mail.offerlogix.me';
          messageId = `conversation-${conversation.id}@${idDomain}`;
          log.warn('No Message-ID found, using conversation-based threading', {
            component: 'inbound-email',
            operation: 'email_threading_fallback',
            conversationId: conversation.id,
            generatedMessageId: messageId
          });
        }
        
        // Debug logging for threading
        log.info('Email threading debug', {
          component: 'inbound-email',
          operation: 'email_threading',
          sender: event.sender,
          subject: event.subject,
          extractedMessageId: messageId,
          hasMessageHeaders: !!event['message-headers'],
          hasDirectMessageId: !!event['Message-Id'],
          hasLowercaseMessageId: !!event['message-id'],
          eventKeys: Object.keys(event).slice(0, 15) // Show available fields
        });
        // Build references chain for proper threading
        let references: string[] = [];
        let originalMessageId: string | undefined; // The Message-ID we should reply to
        
        // First, extract References and In-Reply-To from the incoming email
        try {
          const headersArr: Array<[string, string]> = JSON.parse(event['message-headers'] || '[]');
          
          // Get existing References chain
          const existingRefs = headersArr.find(h => (h[0] || '').toLowerCase() === 'references')?.[1];
          if (existingRefs) {
            const existingRefsList = existingRefs.trim().split(/\s+/).filter(ref => ref.length > 0);
            references = [...existingRefsList];
            // The LAST reference is usually what we should reply to
            if (existingRefsList.length > 0) {
              originalMessageId = existingRefsList[existingRefsList.length - 1].replace(/[<>]/g, '');
            }
          }
          
          // Also check In-Reply-To header from the incoming email
          const inReplyToHeader = headersArr.find(h => (h[0] || '').toLowerCase() === 'in-reply-to')?.[1];
          if (inReplyToHeader && !originalMessageId) {
            originalMessageId = inReplyToHeader.replace(/[<>]/g, '');
            references.push(inReplyToHeader);
          }
          
        } catch {}
        
        // Add the incoming message's Message-ID to the references chain
        if (messageId) {
          references.push(`<${messageId}>`);
        }
        
        // If we still don't have an original Message-ID, use the incoming one (fallback)
        if (!originalMessageId) {
          originalMessageId = messageId;
        }

        const idDomain = (process.env.MAILGUN_DOMAIN || '').split('@').pop()!.trim() || 'mail.offerlogix.me';
        const replyMessageId = `reply-${conversation.id}-${Date.now()}@${idDomain}`;
        
        // Enhanced debug logging
        log.info('Enhanced email threading debug', {
          component: 'inbound-email',
          operation: 'email_threading_enhanced',
          sender: event.sender,
          incomingMessageId: messageId,
          originalMessageId: originalMessageId,
          replyMessageId: replyMessageId,
          inReplyToHeader: originalMessageId ? `<${originalMessageId}>` : undefined,
          referencesChain: references,
          conversationId: conversation.id
        });

        await sendThreadedReply({
          to: extractEmail(event.sender || ''),
          subject: aiResult.reply_subject || `Re: ${event.subject || 'Your email'}`,
          html: sanitizeHtmlBasic(aiResult.reply_body_html || ''),
          messageId: replyMessageId, // Our reply's Message-ID
          inReplyTo: originalMessageId ? `<${originalMessageId}>` : undefined, // Reference to ORIGINAL message we should reply to
          references: references.length > 0 ? references : undefined,
          domainOverride: campaign?.agentEmailDomain, // if present
          conversationId: String(conversation.id), // for plus-addressing token
          campaignId: campaign?.id ? String(campaign.id) : undefined // for tracking headers
        });
      } catch (sendErr) {
        const errorContext = createErrorContext(sendErr, { 
          conversationId: conversation.id,
          recipient: event.sender,
          operation: 'send_ai_reply'
        });
        log.error('Failed to send AI reply email', {
          ...errorContext,
          component: 'inbound-email',
          operation: 'send_ai_reply'
        });
        // Do not fail webhook; proceed to 200 so Mailgun does not retry
      }

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
      const errorContext = createErrorContext(error, { 
        sender: (req.body as any)?.sender,
        recipient: (req.body as any)?.recipient,
        operation: 'inbound_email_processing'
      });
      log.error('Inbound email processing error (non-fatal path will ack)', {
        ...errorContext,
        component: 'inbound-email',
        operation: 'inbound_email_processing'
      });
      // Avoid Mailgun retries causing backpressure; ack and create handover
      try {
        // best-effort handover creation if we still have minimal context
        // (guarded above when conversation is available)
      } catch {}
      const errorResponse = buildErrorResponse(error);
      res.status(200).json({ ...errorResponse, acknowledged: true });
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
        log.warn('MAILGUN_WEBHOOK_SIGNING_KEY not set; bypassing signature verification in non-production', {
          component: 'inbound-email',
          operation: 'webhook_signature_verification',
          environment: process.env.NODE_ENV
        });
        return !!(event.sender && event.timestamp && event.token);
      }
      log.security('MAILGUN_WEBHOOK_SIGNING_KEY missing in production', {
        eventType: 'missing_webhook_key',
        severity: 'high',
        component: 'inbound-email',
        operation: 'webhook_signature_verification',
        environment: process.env.NODE_ENV
      });
      return false;
    }

    try {
      const hmac = createHmac('sha256', signingKey)
        .update(String(event.timestamp) + String(event.token))
        .digest('hex');
      return hmac === event.signature;
    } catch (err) {
      const errorContext = createErrorContext(err, { operation: 'mailgun_signature_verification' });
      log.error('Signature verification error', {
        ...errorContext,
        component: 'inbound-email',
        operation: 'mailgun_signature_verification'
      });
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
