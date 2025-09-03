/**
 * Webhook Handler - Process inbound emails
 * Handles Mailgun webhooks with deduplication and conversation management
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { EmailService } from './email-service';
import { AgentService } from './agent-service';
import { ConversationService } from './conversation-service';
import { 
  agents, 
  leads, 
  conversations, 
  messages, 
  handovers,
  webhookEvents 
} from './schema';
import { eq, and } from 'drizzle-orm';

interface MailgunWebhookData {
  // Required fields
  sender: string;
  recipient: string;
  subject: string;
  timestamp: string;
  token: string;
  signature: string;
  
  // Content fields
  'body-plain'?: string;
  'stripped-text'?: string;
  'body-html'?: string;
  'stripped-html'?: string;
  
  // Headers
  'message-headers'?: string;
  'Message-Id'?: string;
  'In-Reply-To'?: string;
  'References'?: string;
}

export class WebhookHandler {
  private emailService: EmailService;
  private agentService: AgentService;
  private conversationService: ConversationService;
  private webhookSigningKey: string;
  
  constructor(config: {
    emailService: EmailService;
    agentService: AgentService;
    conversationService: ConversationService;
    webhookSigningKey: string;
  }) {
    this.emailService = config.emailService;
    this.agentService = config.agentService;
    this.conversationService = config.conversationService;
    this.webhookSigningKey = config.webhookSigningKey;
  }

  /**
   * Main webhook handler for inbound emails
   */
  async handleInboundEmail(req: Request, res: Response) {
    try {
      const data: MailgunWebhookData = req.body;
      
      // Verify webhook signature
      if (!this.verifyWebhookSignature(data)) {
        console.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // Extract Message-ID for deduplication
      const messageId = this.extractMessageId(data);
      if (!messageId) {
        console.warn('No Message-ID found in webhook');
        return res.status(400).json({ error: 'Missing Message-ID' });
      }
      
      // Check for duplicate processing
      const isDuplicate = await this.checkDuplicate(messageId);
      if (isDuplicate) {
        console.log('Duplicate webhook ignored:', messageId);
        return res.status(200).json({ status: 'duplicate' });
      }
      
      // Record webhook event
      await db.insert(webhookEvents).values({
        eventType: 'email_received',
        provider: 'mailgun',
        providerMessageId: messageId,
        rawPayload: data as any,
        processed: false,
      });
      
      // Process the email
      await this.processInboundEmail(data);
      
      // Mark webhook as processed
      await db
        .update(webhookEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(webhookEvents.providerMessageId, messageId));
      
      res.status(200).json({ status: 'processed' });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  }

  /**
   * Verify Mailgun webhook signature
   */
  private verifyWebhookSignature(data: MailgunWebhookData): boolean {
    const { timestamp, token, signature } = data;
    
    if (!timestamp || !token || !signature) {
      return false;
    }
    
    // Check timestamp is recent (within 5 minutes)
    const webhookTime = parseInt(timestamp) * 1000;
    const now = Date.now();
    if (Math.abs(now - webhookTime) > 5 * 60 * 1000) {
      console.warn('Webhook timestamp too old');
      return false;
    }
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSigningKey)
      .update(timestamp + token)
      .digest('hex');
    
    return expectedSignature === signature;
  }

  /**
   * Extract Message-ID from webhook data
   */
  private extractMessageId(data: MailgunWebhookData): string | null {
    // Try direct field first
    if (data['Message-Id']) {
      return data['Message-Id'].replace(/[<>]/g, '').trim();
    }
    
    // Try parsing message-headers
    if (data['message-headers']) {
      try {
        const headers = JSON.parse(data['message-headers']);
        const messageIdHeader = headers.find(
          ([key]: [string, string]) => key.toLowerCase() === 'message-id'
        );
        if (messageIdHeader) {
          return messageIdHeader[1].replace(/[<>]/g, '').trim();
        }
      } catch (error) {
        console.warn('Failed to parse message-headers');
      }
    }
    
    return null;
  }

  /**
   * Check if we've already processed this message
   */
  private async checkDuplicate(messageId: string): Promise<boolean> {
    // Check webhook events table
    const existingWebhook = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.providerMessageId, messageId))
      .limit(1);
    
    if (existingWebhook.length > 0) {
      return true;
    }
    
    // Check messages table
    const existingMessage = await db
      .select()
      .from(messages)
      .where(eq(messages.messageId, messageId))
      .limit(1);
    
    return existingMessage.length > 0;
  }

  /**
   * Process the inbound email
   */
  private async processInboundEmail(data: MailgunWebhookData) {
    // Extract email details
    const senderEmail = this.extractEmail(data.sender);
    const recipientEmail = this.extractEmail(data.recipient);
    const content = data['stripped-text'] || data['body-plain'] || '';
    
    // Parse email headers for threading
    const emailHeaders = EmailService.parseEmailHeaders(data);
    
    // Find the agent by email
    const agent = await this.findAgentByEmail(recipientEmail);
    if (!agent) {
      console.warn('No agent found for recipient:', recipientEmail);
      return;
    }
    
    // Find or create the lead
    const lead = await this.findOrCreateLead(senderEmail);
    
    // Find or create the conversation
    const conversation = await this.conversationService.findOrCreateConversation({
      agentId: agent.id,
      leadId: lead.id,
      threadId: emailHeaders.threadId,
      initialMessageId: emailHeaders.messageId,
    });
    
    // Store the inbound message
    const inboundMessage = await db.insert(messages).values({
      conversationId: conversation.id,
      direction: 'inbound',
      senderType: 'lead',
      messageId: emailHeaders.messageId,
      inReplyTo: emailHeaders.inReplyTo,
      references: emailHeaders.references?.join(' '),
      subject: data.subject,
      content,
      status: 'delivered',
      deliveredAt: new Date(),
    }).returning();
    
    // Update conversation metrics
    await this.conversationService.updateConversationMetrics(conversation.id);
    
    // Generate AI response
    const recentMessages = await this.conversationService.getRecentMessages(
      conversation.id, 
      5
    );
    
    const aiResponse = await this.agentService.generateResponse({
      agent,
      conversation,
      messages: recentMessages,
      leadMessage: content,
    });
    
    // Check if handover is needed
    if (aiResponse.shouldHandover) {
      await this.triggerHandover(
        conversation,
        aiResponse.handoverReason || 'Manual review needed'
      );
      
      // Send a polite handover message
      await this.sendResponse({
        agent,
        lead,
        conversation,
        content: aiResponse.content,
        inReplyTo: emailHeaders.messageId,
        references: this.buildReferenceChain(recentMessages),
      });
      
      return;
    }
    
    // Send AI response
    await this.sendResponse({
      agent,
      lead,
      conversation,
      content: aiResponse.content,
      inReplyTo: emailHeaders.messageId,
      references: this.buildReferenceChain(recentMessages),
      confidence: aiResponse.confidence,
    });
  }

  /**
   * Extract email address from sender/recipient field
   */
  private extractEmail(field: string): string {
    // Handle format: "Name <email@domain.com>"
    const match = field.match(/<(.+)>/);
    if (match) {
      return match[1].toLowerCase();
    }
    // Assume it's just the email address
    return field.toLowerCase();
  }

  /**
   * Find agent by email address
   */
  private async findAgentByEmail(email: string): Promise<any> {
    const result = await db
      .select()
      .from(agents)
      .where(and(
        eq(agents.senderEmail, email),
        eq(agents.isActive, true)
      ))
      .limit(1);
    
    return result[0];
  }

  /**
   * Find or create a lead
   */
  private async findOrCreateLead(email: string): Promise<any> {
    // Try to find existing lead
    let leadResult = await db
      .select()
      .from(leads)
      .where(eq(leads.email, email))
      .limit(1);
    
    if (leadResult.length > 0) {
      return leadResult[0];
    }
    
    // Create new lead
    const newLead = await db.insert(leads).values({
      email,
      status: 'active',
    }).returning();
    
    return newLead[0];
  }

  /**
   * Build reference chain from messages
   */
  private buildReferenceChain(messages: Message[]): string[] {
    return messages
      .filter(m => m.messageId)
      .map(m => m.messageId as string)
      .slice(-10); // Keep last 10 for header size
  }

  /**
   * Send email response
   */
  private async sendResponse(params: {
    agent: any;
    lead: any;
    conversation: any;
    content: string;
    inReplyTo?: string;
    references?: string[];
    confidence?: number;
  }) {
    const { agent, lead, conversation, content, inReplyTo, references, confidence } = params;
    
    // Send email
    const emailResult = await this.emailService.sendEmail({
      to: lead.email,
      subject: `Re: ${conversation.subject || 'Your inquiry'}`,
      content,
      agent,
      threadId: conversation.threadId,
      inReplyTo,
      references,
    });
    
    if (!emailResult.success) {
      console.error('Failed to send response email:', emailResult.error);
      return;
    }
    
    // Store outbound message
    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: 'outbound',
      senderType: 'agent',
      messageId: emailResult.messageId,
      inReplyTo,
      references: references?.join(' '),
      subject: `Re: ${conversation.subject || 'Your inquiry'}`,
      content,
      aiConfidence: confidence?.toString(),
      aiModel: 'openai/gpt-4-turbo-preview',
      status: 'sent',
    });
    
    // Update conversation metrics
    await this.conversationService.updateConversationMetrics(conversation.id);
  }

  /**
   * Trigger handover to human
   */
  private async triggerHandover(conversation: any, reason: string) {
    // Check if handover already exists
    const existingHandover = await db
      .select()
      .from(handovers)
      .where(and(
        eq(handovers.conversationId, conversation.id),
        eq(handovers.status, 'pending')
      ))
      .limit(1);
    
    if (existingHandover.length > 0) {
      return; // Handover already pending
    }
    
    // Get conversation messages for summary
    const messages = await this.conversationService.getRecentMessages(
      conversation.id,
      10
    );
    
    // Generate summary for human agent
    const summary = await this.agentService.generateHandoverSummary(
      conversation,
      messages
    );
    
    // Create handover record
    await db.insert(handovers).values({
      conversationId: conversation.id,
      triggerType: this.determineTriggerType(reason),
      triggerDetail: reason,
      status: 'pending',
      conversationSummary: summary,
    });
    
    // Update conversation status
    await db
      .update(conversations)
      .set({
        status: 'handed_over',
        handedOverAt: new Date(),
        handoverReason: reason,
      })
      .where(eq(conversations.id, conversation.id));
    
    // TODO: Send notification to human agent (email, Slack, etc.)
    console.log('🚨 Handover triggered:', {
      conversationId: conversation.id,
      reason,
      summary,
    });
  }

  /**
   * Determine trigger type from reason
   */
  private determineTriggerType(reason: string): 'keyword' | 'max_messages' | 'low_confidence' | 'manual' {
    const lowerReason = reason.toLowerCase();
    
    if (lowerReason.includes('keyword') || lowerReason.includes('mentioned')) {
      return 'keyword';
    }
    if (lowerReason.includes('message limit') || lowerReason.includes('max')) {
      return 'max_messages';
    }
    if (lowerReason.includes('confidence')) {
      return 'low_confidence';
    }
    
    return 'manual';
  }
}
