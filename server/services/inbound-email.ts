import { Request, Response } from 'express';

function extractEmail(addr?: string): string {
  if (!addr) return '';
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim();
}

function extractHeaderFromMailgunHeaders(headers: any, headerName: string): string | null {
  try {
    let headerArray = headers;
    
    // Handle string JSON
    if (typeof headers === 'string') {
      try {
        headerArray = JSON.parse(headers);
      } catch (e) {
        // Try regex fallback for malformed JSON
        const regex = new RegExp(`["']${headerName}["']\\s*:\\s*["']([^"']+)["']`, 'i');
        const match = headers.match(regex);
        return match ? match[1] : null;
      }
    }
    
    // Search for header in array format
    if (Array.isArray(headerArray)) {
      for (const header of headerArray) {
        if (Array.isArray(header) && header.length >= 2) {
          const [key, value] = header;
          if (key && typeof key === 'string' && key.toLowerCase() === headerName.toLowerCase()) {
            return (value || '').toString().trim();
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Failed to extract ${headerName} header from Mailgun headers:`, error);
    return null;
  }
}

function extractLocal(recipient: string) {
  const match = recipient.toLowerCase().match(/^[^@]+/);
  return match ? match[0] : '';
}

function tryGetConversationIdFromRecipient(recipient?: string): number | null {
  if (!recipient) return null;
  const local = recipient.toLowerCase().split('@')[0];          // brittany+conv_12345
  const m = local.match(/conv_(\d+)/);
  return m ? Number(m[1]) : null;
}
import { createHmac, createHash } from 'crypto';
import { storage } from '../storage';
import { sendThreadedReply } from './mailgun-threaded';
import { callOpenRouterJSON } from './call-openrouter';
import { buildErrorResponse, createErrorContext } from '../utils/error-utils';
import { log } from '../logging/logger';
import { ConversationRateLimiters } from './conversation-rate-limiter';

function sanitizeHtmlBasic(content: string): string {
  if (!content) return '';
  // If content already contains proper HTML paragraph tags, return as-is
  if (/<p[^>]*>.*<\/p>/i.test(content)) {
    return content; // AI already provided proper HTML formatting
  }
  // If content has basic HTML tags, trust it
  if (/<p|<br\s*\/?>/i.test(content)) return content;

  // NEW: Check for markdown-like formatting and convert it
  if (/\*\*.*\*\*|\*.*\*|`.*`|^\s*[-*+]\s/m.test(content)) {
    const converted = convertMarkdownToHtml(content);
    return ensureNoRawMarkdown(converted);
  }

  // Otherwise, convert plain text to paragraphs
  const paras = content.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`).join('');
}

/**
 * Convert simple markdown-like formatting to safe HTML
 * Supports: **bold**, *italic*, `code`, line breaks, simple lists
 */
function convertMarkdownToHtml(text: string): string {
  let html = text;

  // Convert **bold** to <strong>
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert *italic* to <em>
  html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Convert `code` to <code> (simple inline code)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Handle simple lists (- item or * item at start of line)
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  for (const line of lines) {
    const listMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(`<li>${listMatch[1]}</li>`);
    } else {
      if (inList) {
        // End list and add it
        processedLines.push(`<ul>${listItems.join('')}</ul>`);
        inList = false;
        listItems = [];
      }
      processedLines.push(line);
    }
  }

  // Close any remaining list
  if (inList) {
    processedLines.push(`<ul>${listItems.join('')}</ul>`);
  }

  html = processedLines.join('\n');

  // Convert double line breaks to paragraphs, single line breaks to <br>
  const paragraphs = html.split(/\n{2,}/);
  const formattedParas = paragraphs.map(para => {
    // Replace single line breaks with <br>, but avoid double <br><br>
    const withBreaks = para.replace(/\n/g, '<br>');
    return `<p>${withBreaks}</p>`;
  });

  return formattedParas.join('');
}

/**
 * Safety check to ensure no raw markdown symbols remain in the output
 */
function ensureNoRawMarkdown(html: string): string {
  // Strip any remaining raw markdown symbols that weren't converted
  return html
    .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove unconverted bold markers
    .replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '$1')  // Remove unconverted italic markers
    .replace(/`(.*?)`/g, '$1')  // Remove unconverted code markers
    .replace(/^\s*[-*+]\s+/gm, '')  // Remove unconverted list markers
    .replace(/#{1,6}\s*/g, '');  // Remove any header markers
}

// Robust extraction of Message-ID from Mailgun inbound payload
function extractMessageId(event: MailgunInboundEvent): string {
  try {
    let id = (event as any)['Message-Id'] || (event as any)['message-id'] || (event as any)['Message-ID'] || '';
    if (!id && event['message-headers']) {
      id = extractHeaderFromMailgunHeaders(event['message-headers'], 'Message-Id')
        || extractHeaderFromMailgunHeaders(event['message-headers'], 'Message-ID')
        || '';
    }
    if (typeof id === 'string') {
      const cleaned = id.trim();
      if (cleaned) {
        // Ensure it is wrapped in angle brackets for consistency
        const normalized = /<.*>/.test(cleaned) ? cleaned : `<${cleaned.replace(/[<>\s]/g, '')}>`;
        return normalized.slice(0, 512);
      }
    }
  } catch {}
  // Fallback: synthesize a deterministic Message-ID to maintain threading
  const domain = ((event.recipient || '').split('@')[1]) || (process.env.MAILGUN_DOMAIN || 'local');
  const hash = createHash('sha1')
    .update([event.sender || '', event.recipient || '', String(event.timestamp || Date.now()), event.subject || ''].join('|'))
    .digest('hex');
  return `<synthetic.${hash}@${domain}>`;
}

// Try to identify a conversation using email threading semantics
async function findConversationByThreading(
  incomingMessageId: string,
  inReplyToHeader: string,
  referencesHeader: string
): Promise<string | null> {
  // Normalize helper to ensure angle-bracketed IDs
  const normalizeId = (s?: string) => {
    if (!s) return '';
    const raw = s.trim();
    if (!raw) return '';
    // Extract first <...> if present
    const m = raw.match(/<([^>]+)>/);
    const id = m ? m[0] : `<${raw.replace(/[<>\s]/g, '')}>`;
    return id.slice(0, 512);
  };

  try {
    // 1) In-Reply-To directly references the prior message-id in the thread
    const inReplyTo = normalizeId(inReplyToHeader);
    if (inReplyTo) {
      const prior = await storage.getConversationMessageByMessageId(inReplyTo);
      if (prior) return prior.conversationId;
    }

    // 2) References may include a chain; search from rightmost (most recent)
    if (referencesHeader && typeof referencesHeader === 'string') {
      const parts = referencesHeader
        .split(/\s+/)
        .map(normalizeId)
        .filter(Boolean)
        .slice(-10) // cap
        .reverse(); // search most recent first
      for (const ref of parts) {
        const msg = await storage.getConversationMessageByMessageId(ref);
        if (msg) return msg.conversationId;
      }
    }

    // 3) Look for a conversation that started with this original Message-ID
    if (incomingMessageId) {
      const conv = await storage.getConversationByOriginalMessageId(incomingMessageId);
      if (conv) return conv.id;
    }
  } catch (err) {
    log.warn('Threading lookup failed', {
      component: 'inbound-email',
      operation: 'conversation_lookup_threading',
      error: (err as any)?.message || String(err)
    });
  }

  return null;
}


// Basic safeguards
const REPLY_RATE_LIMIT_MINUTES = parseInt(process.env.AI_REPLY_RATE_LIMIT_MINUTES || '15', 10);

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

      // Verify Mailgun webhook signature:
      // - In production with a configured signing key: reject processing on invalid signature (ack 200 to prevent retries)
      // - Without a signing key (e.g., during setup): log a warning but continue to process for operability
      const hasSigningKey = !!process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
      const isValidSignature = this.verifyMailgunSignature(event);
      if (process.env.NODE_ENV === 'production' && hasSigningKey && !isValidSignature) {
        log.warn('Mailgun signature verification failed - ignoring payload', {
          component: 'inbound-email',
          operation: 'webhook_signature_verification',
          sender: event.sender,
          recipient: event.recipient,
          hasSignature: !!event.signature,
          hasTimestamp: !!event.timestamp,
          hasToken: !!event.token
        });
        return res.status(200).json({ message: 'Ignored: invalid signature' });
      } else if (process.env.NODE_ENV === 'production' && !hasSigningKey) {
        log.warn('MAILGUN_WEBHOOK_SIGNING_KEY not set; proceeding without strict verification', {
          component: 'inbound-email',
          operation: 'webhook_signature_verification'
        });
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
        const senderEmail = extractEmail(event.sender).toLowerCase();
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
        const senderEmail = extractEmail(event.sender).toLowerCase();
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

      // CRITICAL: Proper email threading conversation lookup
      let conversation: any = null;
      
      // Extract Message-ID and threading headers first
      const incomingMessageId = extractMessageId(event);
      
      // Extract In-Reply-To header
      let inReplyToHeader = event['In-Reply-To'] || event['in-reply-to'] || '';
      if (!inReplyToHeader && event['message-headers']) {
        inReplyToHeader = extractHeaderFromMailgunHeaders(event['message-headers'], 'In-Reply-To') || '';
      }
      
      // Extract References header  
      let referencesHeader = event['References'] || event['references'] || '';
      if (!referencesHeader && event['message-headers']) {
        referencesHeader = extractHeaderFromMailgunHeaders(event['message-headers'], 'References') || '';
      }
      
      // 1) Primary: Find conversation by email threading (MESSAGE-ID based)
      const threadedConversationId = await findConversationByThreading(
        incomingMessageId, 
        inReplyToHeader, 
        referencesHeader
      );
      
      if (threadedConversationId) {
        try {
          conversation = await storage.getConversation(threadedConversationId);
          if (conversation) {
            log.info('Conversation found via email threading', {
              component: 'inbound-email',
              operation: 'conversation_lookup_threading',
              conversationId: threadedConversationId,
              sender: event.sender,
              incomingMessageId,
              method: 'message_id_threading'
            });
          }
        } catch (err) {
          log.warn('Failed to get threaded conversation', {
            component: 'inbound-email',
            operation: 'conversation_lookup_threading',
            conversationId: threadedConversationId,
            error: (err as any).message
          });
        }
      }
      
      // 2) Fallback A: token in recipient (legacy)
      if (!conversation) {
        const recipientConvId = tryGetConversationIdFromRecipient(event.recipient || '');
        if (recipientConvId) {
          try {
            conversation = await storage.getConversation(recipientConvId.toString());
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
      }
      
      // 3) Fallback B: create or get conversation (original logic)
      if (!conversation) {
        conversation = await this.getOrCreateConversation(leadInfo.leadId, event.subject, campaignId, incomingMessageId);
      }

      // Save the email as a conversation message WITH Message-ID for threading
      await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: null, // Lead replies don't have a user ID
        messageType: 'email',
        content: event['stripped-text'] || event['body-plain'],
        isFromAI: 0,
        // CRITICAL: Save Message-ID for proper threading
        messageId: incomingMessageId,
        inReplyTo: inReplyToHeader,
        references: referencesHeader,
        emailHeaders: {
          'Message-ID': incomingMessageId,
          'In-Reply-To': inReplyToHeader,
          'References': referencesHeader,
          'Subject': event.subject || '',
          'From': event.sender || '',
          'To': event.recipient || '',
          'Date': new Date(event.timestamp * 1000).toISOString()
        }
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
You are Brittany from OfferLogix - a seasoned automotive fintech strategist who helps dealerships close more deals faster and waste less time on dead-end leads. You speak like a trusted partner who's been in the trenches and knows what actually moves the needle for GMs and dealer principals.

### OfferLogix Credit Solutions Knowledge
Main Value Proposition: "Stop wasting time on unqualified leads. Start closing more deals with real credit data."

What We Do: OfferLogix Instant Credit Solutions provide real-time credit processing without impacting consumer credit scores, giving dealerships the power to pre-qualify leads and close deals faster.

Company Scale:
- 8,000+ dealerships powered in North America  
- 18+ years of automotive fintech experience
- Direct partnerships with Equifax for credit data

### Core Solution: Instant Credit Solutions
Real-time credit processing that delivers:
- Soft credit pulls from Equifax (no credit score impact on customers)
- Real-time credit approvals with live APR from selected banks
- Credit Perfect Payments using actual credit scores
- White-labeled customer credit dashboard for seamless integration
- Pre-qualification that turns website traffic into qualified leads

Operational Outcomes:
- Higher conversion rates – turn more website traffic into actual sales
- Faster deal cycles – get customers from interest to signed paperwork quicker
- Better F&I efficiency – arm your F&I team with real credit data before customers walk in
- Cost reduction – save up to 30% on credit pulls through direct-to-dealer pricing
- Improved customer experience – no surprises, streamlined process

Proven Results:
- Team Ford Las Vegas: 399 pre-qualified leads, 345 finance apps, 37 transactions in one month
- +60% showroom visits from qualified leads
- Reduced deal fallout through better pre-qualification
- Faster F&I process with upfront credit data

Key Partnership: Direct integration with Equifax for reliable, instant credit data

Target Audiences: 
- Dealers: GMs, Dealer Principals, Finance Managers, Digital Marketing Managers
- Focus: Cost-conscious, efficiency-focused, and growth-oriented dealerships

### Communication Style & Response Framework
Your Approach:
1. Acknowledge their reality: "Most GMs tell me their biggest frustration is..."
2. Connect to business impact: "That's costing you X deals per month because..."
3. Present the solution: "Here's how we fix that..."
4. Show proof: "Team Ford Las Vegas saw..."
5. Clear next step: "Worth a 15-minute call to see if this works for your store?"

Key Talking Points by Dealer Type:

For Cost-Conscious Dealers:
"If you're already doing soft pulls, we can save you up to 30 percent with our direct-to-dealer model."

For Efficiency-Focused Dealers:
"Your sales team stops chasing unqualified leads. Your F&I team gets real credit data upfront. Deals close faster."

For Growth-Oriented Dealers:
"Team Ford Las Vegas went from guessing to knowing. 399 pre-qualified leads in one month. That's the difference."

For Skeptical Dealers:
"Look, I get it. Another vendor promising the world. Here's the difference: we integrate with your existing systems, and you see results in week one, not month six."

### What You Focus On
- Time savings – how many hours per week this saves their sales team
- Revenue impact – additional deals closed per month  
- Cost reduction – actual dollar savings on credit pulls
- Operational efficiency – fewer dead-end leads, faster F&I process
- Competitive advantage – what this lets them do that competitors can't

### What You Avoid
- Generic customer psychology lessons
- Explaining basic automotive concepts to industry veterans  
- Theoretical benefits without real numbers
- Corporate marketing speak
- Over-hyped language ("revolutionary," "game-changing")

### Rules of Engagement
1. Respect their expertise: You're talking to people who know cars, know sales, and know their numbers
2. Focus on business impact: Always tie back to deals closed, time saved, costs reduced
3. Use real proof points: Team Ford Las Vegas case study, specific percentages, actual results
4. One clear next step: Simple ask for a brief call or demo
5. Handle objections directly: Acknowledge skepticism, provide concrete differentiation

### Prime Directive
Sound like a seasoned automotive fintech partner who understands dealer operations and speaks their language. Focus on how OfferLogix credit solutions make their job easier and their dealership more profitable.

### EMAIL FORMATTING REQUIREMENTS
- Write in PLAIN, CONVERSATIONAL text - NO raw markdown symbols like ** or ## should EVER appear in the final email
- Use HTML paragraph tags (<p></p>) for proper spacing
- Keep emails concise - 3-4 short paragraphs maximum
- Write like a normal business email, not a formatted document
- FORMATTING THROUGH CONVERSION (these will be automatically converted to HTML):
  - Use **double asterisks around text** for bold (converts to <strong>)
  - Use *single asterisks around text* for italic (converts to <em>)
  - Use `backticks around text` for code styling (converts to <code>)
  - Use - or * at start of lines for bullet points (converts to <ul><li>)
- Professional but direct tone throughout
- Each paragraph should be wrapped in <p></p> tags for proper spacing
- Line breaks within paragraphs create <br> tags for readability
- NO visible markdown symbols, asterisks, or formatting characters in final output

EXAMPLE GOOD FORMAT:
<p>Hi [Name],</p>
<p>Most GMs tell me their biggest frustration is chasing leads that can't actually buy. That's costing you 10-15 deals per month because your sales team is spinning their wheels on unqualified prospects.</p>
<p>Here's what we can do:
- Pre-qualify leads with soft credit pulls
- Save up to 30% on credit processing
- Get real-time approvals from Equifax
</p>
<p>Worth a 15-minute call to see how this works for your store?</p>
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

      // Log rationale (don't sanitize here - will be done in sendThreadedReply)
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

      // Send simple reply via Mailgun
      try {
        log.info('[Simple Email] Processing reply', {
          from: event.sender,
          to: event.recipient,
          conversationId: conversation.id,
          subject: event.subject
        });

        await sendThreadedReply({
          to: extractEmail(event.sender || ''),
          subject: aiResult.reply_subject || `Re: ${event.subject || 'Your inquiry'}`,
          html: aiResult.reply_body_html || '',
          domainOverride: campaign?.agentEmailDomain,
          conversationId: String(conversation.id),
          campaignId: campaign?.id ? String(campaign.id) : undefined
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

      // Note: AI reply message is now saved in sendThreadedReply with proper Message-ID

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

  private static async getOrCreateConversation(leadId: string, subject: string, campaignId?: string, originalMessageId?: string) {
    // Try to find existing conversation for this lead
    const conversations = await storage.getConversationsByLead(leadId);

    if (conversations.length > 0) {
      // Return most recent conversation and update with original Message-ID if needed
      const conversation = conversations[0];
      if (originalMessageId && !conversation.originalMessageId) {
        try {
          await storage.updateConversationThreading(
            conversation.id, 
            [conversation.threadMessageIds || [], originalMessageId].flat(), 
            originalMessageId
          );
        } catch (error) {
          console.warn('[Threading] Failed to update conversation with original Message-ID:', error);
        }
      }
      return conversation;
    }

    // Create new conversation with original Message-ID for proper threading
    const newConversation = await storage.createConversation({
      leadId,
      campaignId,
      subject: subject || 'Email Conversation',
      status: 'active'
    } as any);

    // Set original Message-ID if provided
    if (originalMessageId) {
      try {
        await storage.updateConversationThreading(
          newConversation.id,
          [originalMessageId],
          originalMessageId
        );
      } catch (error) {
        console.warn('[Threading] Failed to set original Message-ID on new conversation:', error);
      }
    }

    return newConversation;
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
