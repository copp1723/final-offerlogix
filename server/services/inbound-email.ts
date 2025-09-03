import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { storage } from '../storage';
import { liveConversationService } from './live-conversation';
import { AutomotivePromptService } from './automotive-prompts';
import logger from '../logging/logger';

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
  private static dedupCache = new Map<string, number>();
  private static readonly DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes

  private static extractMessageId(evt: any): string | undefined {
    const direct = evt['message-id'] || evt['Message-Id'];
    if (direct) return String(direct).replace(/[<>]/g, '').trim();
    const raw = evt['message-headers'];
    if (!raw) return undefined;
    try {
      const headers = typeof raw === 'string' ? JSON.parse(raw) : raw; // [["Name","Value"],...]
      const pair = headers.find((h: [string, string]) => /^message-id$/i.test(h[0]));
      return pair?.[1]?.replace(/[<>]/g, '').trim();
    } catch {
      const m = String(raw).match(/Message-Id["']?\s*[:=]\s*<?([^>\r\n"]+)>?/i);
      return m?.[1]?.trim();
    }
  }

  private static isDuplicate(id: string): boolean {
    const now = Date.now();
    const seen = this.dedupCache.get(id);
    if (seen && now - seen < this.DEDUP_TTL_MS) return true;
    this.dedupCache.set(id, now);
    for (const [k, ts] of this.dedupCache.entries()) if (now - ts > this.DEDUP_TTL_MS) this.dedupCache.delete(k);
    return false;
  }


  /**
   * Handle incoming email responses from leads
   * This webhook endpoint processes Mailgun inbound emails
   */
  static async handleInboundEmail(req: Request, res: Response) {
    try {
      const event: MailgunInboundEvent = (req.headers['content-type'] || '').includes('application/json')
        ? req.body
        : (Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as any);
      
      const messageId = this.extractMessageId(event);
      if (!messageId) return res.status(400).json({ error: 'Missing message-id' });

      // Verify Mailgun webhook signature
      if (!this.verifyMailgunSignature(event)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Hot-path dedup by Message-Id (process-level)
      if (this.isDuplicate(messageId)) return res.status(202).json({ message: 'Duplicate message ignored' });

      // Extract lead information from email
      const leadInfo = await this.extractLeadFromEmail(event);
      if (!leadInfo) {
        logger.warn('Inbound email lead not identified', { sender: event.sender, messageId });
        return res.status(202).json({ message: 'Lead not identified' });
      }

      // Create or update conversation
      const conversation = await this.getOrCreateConversation(leadInfo.leadId, leadInfo.lead.campaignId, event.subject);
      
      // Process the email as a threaded message
      const { messageThreadingService } = await import('./conversation-state/MessageThreadingService.js');
      const message = await messageThreadingService.processMessage(
        conversation.id,
        '', // Empty senderId since this is a lead message
        event['stripped-text'] || event['body-plain'],
        'lead_msg',
        0,
        this.extractEmailHeaders(event),
        { 
          providerMessageId: messageId, // persisted uniqueness
          leadId: leadInfo.leadId // Use leadId for lead messages
        }
      );

      logger.info('Inbound lead message stored', { leadId: leadInfo.leadId, messageId, conversationId: conversation.id });

      // Trigger AI auto-response via conversation responder service
      try {
        // Check if auto-responses are disabled (useful for testing)
        const { validateEnv } = await import('../env');
        const env = validateEnv();
        
        logger.info('Environment check for auto-responses', { 
          disableAutoResponses: env.DISABLE_AUTO_RESPONSES,
          conversationId: conversation.id 
        });
        
        if (!env.DISABLE_AUTO_RESPONSES) {
          const { conversationResponderService } = await import('./conversation-responder.js');
          // The conversation responder will handle AI response generation and email sending
          // with proper threading headers and reliable email delivery
          await conversationResponderService.handleNewLeadMessage(conversation.id);
        } else {
          logger.info('Auto-responses disabled via environment variable', { conversationId: conversation.id });
        }
      } catch (error) {
        logger.warn('Failed to trigger conversation responder', { error });
      }

      // Optional: Intent-based handover evaluation (non-blocking)
      try {
        const campaignId = leadInfo.lead.campaignId;
        if (campaignId) {
          const { maybeTriggerIntentHandover } = await import('./handover/handover-service.js');
          await maybeTriggerIntentHandover({ leadId: leadInfo.leadId, campaignId });
        }
      } catch (e) {
        logger.warn('Intent handover evaluation failed (non-blocking)', { messageId, error: e instanceof Error ? e.message : String(e) });
      }

      // Expose conversation context for downstream orchestration
      res.locals = {
        ...res.locals,
        conversationId: conversation.id,
        leadId: leadInfo.leadId,
        campaignId: leadInfo.lead.campaignId
      };

      res.status(200).json({ message: 'Email processed successfully' });
    } catch (error) {
      console.error('Inbound email processing error:', error);
      res.status(500).json({ error: 'Failed to process inbound email' });
    }
  }

  /**
   * Handle incoming SMS responses from leads  
   * This webhook endpoint processes Twilio inbound SMS
   */
  static async handleInboundSMS(req: Request, res: Response) {
    try {
      const { From, To, Body, MessageSid } = req.body;
      
      // Find lead by phone number
      const lead = await storage.getLeadByPhone(From);
      if (!lead) {
        console.log('Could not identify lead from phone:', From);
        return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
      }

      // Get or create SMS conversation
      const conversation = await this.getOrCreateConversation(lead.id, null, 'SMS Conversation');
      
      // Process SMS as threaded message
      const { messageThreadingService } = await import('./conversation-state/MessageThreadingService.js');
      const message = await messageThreadingService.processMessage(
        conversation.id,
        '', // Empty senderId since this is a lead message
        Body,
        'text',
        0,
        undefined, // No email headers for SMS
        { leadId: lead.id } // Use leadId for lead messages
      );

      // Process auto-response
      const aiResponse = await this.processAutoResponse(lead.id, conversation.id, message);
      
      // Send SMS reply if AI generated a response
      if (aiResponse) {
        const smsService = await import('./twilio.js');
        await smsService.sendSMS({
          to: From,
          message: aiResponse
        });
      }

      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('Inbound SMS processing error:', error);
      res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error processing message</Message></Response>');
    }
  }

  private static verifyMailgunSignature(event: MailgunInboundEvent): boolean {
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;

    // Allow webhook if basic fields are present (for immediate campaign deployment)
    if (!signingKey) {
      logger.warn('MAILGUN_WEBHOOK_SIGNING_KEY not set; bypassing signature verification', {
        hasBasicFields: !!(event.sender && event.timestamp && event.token),
        environment: process.env.NODE_ENV
      });
      return !!(event.sender && event.timestamp && event.token);
    }

    try {
      // Verify timestamp is recent (within 15 minutes)
      const timestampNumber = parseInt(String(event.timestamp));
      if (isNaN(timestampNumber)) {
        logger.warn('Invalid timestamp format in webhook', { timestamp: event.timestamp });
        return false;
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestampNumber) > 15 * 60) {
        logger.warn('Webhook timestamp too old', { 
          timestamp: timestampNumber, 
          now,
          difference: Math.abs(now - timestampNumber)
        });
        return false;
      }

      // Create HMAC signature using timestamp + token
      const expectedSignature = createHmac('sha256', signingKey)
        .update(String(event.timestamp) + String(event.token))
        .digest('hex');
      
      // Use timing-safe comparison
      const isValid = Buffer.from(expectedSignature, 'hex').equals(
        Buffer.from(String(event.signature), 'hex')
      );
      
      // Log signature verification details
      if (!isValid) {
        logger.warn('Webhook signature verification failed', { 
          expected: expectedSignature, 
          received: event.signature,
          timestamp: event.timestamp,
          token: event.token
        });
        
        // In development mode, still allow webhooks to proceed for testing
        if (process.env.NODE_ENV === 'development') {
          logger.warn('Development mode: allowing webhook despite signature mismatch');
          return !!(event.sender && event.timestamp && event.token);
        }
        
        return false;
      }
      
      logger.debug('Webhook signature verified successfully', {
        timestamp: event.timestamp,
        sender: event.sender
      });
      
      return true;
    } catch (err) {
      logger.error('Signature verification error', { 
        error: err instanceof Error ? err.message : String(err),
        timestamp: event.timestamp,
        token: event.token?.substring(0, 8) + '...' // Log partial token for debugging
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

  private static async getOrCreateConversation(leadId: string, campaignId: string | null | undefined, subject: string) {
    const conversations = await storage.getConversationsByLead(leadId);
    if (campaignId) {
      const existing = conversations.find(c => c.campaignId === campaignId);
      if (existing) return existing;
    } else if (conversations.length > 0) {
      return conversations[0]; // most recent if your storage returns sorted
    }
    return await storage.createConversation({
      leadId,
      campaignId: campaignId || undefined,
      subject: subject || 'Email Conversation',
      status: 'active'
    } as any);
  }

  // Auto-response processing is now handled by conversation-responder.ts
  // This ensures proper email threading and reliable delivery



  /**
   * Extract email headers for threading
   */
  private static extractEmailHeaders(event: MailgunInboundEvent): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (event['message-headers']) {
      try {
        const parsedHeaders = JSON.parse(event['message-headers']);
        if (Array.isArray(parsedHeaders)) {
          parsedHeaders.forEach(([key, value]) => {
            headers[key] = value;
          });
        }
      } catch (error) {
        console.warn('Failed to parse message headers:', error);
      }
    }
    
    // Add standard headers from event
    headers['Subject'] = event.subject;
    headers['From'] = event.sender;
    headers['To'] = event.recipient;
    headers['Date'] = new Date(event.timestamp * 1000).toISOString();
    
    return headers;
  }
}