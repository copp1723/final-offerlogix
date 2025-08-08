import { Request, Response } from 'express';
import { storage } from '../storage';
import { liveConversationService } from './live-conversation';
import { AutomotivePromptService } from './automotive-prompts';
import { emailMonitorService } from './email-monitor';

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
      const event: MailgunInboundEvent = req.body;
      
      // Verify Mailgun webhook signature
      if (!this.verifyMailgunSignature(event)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Extract lead information from email
      const leadInfo = await this.extractLeadFromEmail(event);
      if (!leadInfo) {
        console.log('Could not identify lead from email:', event.sender);
        return res.status(200).json({ message: 'Email processed but lead not identified' });
      }

      // Create or update conversation
      const conversation = await this.getOrCreateConversation(leadInfo.leadId, event.subject);
      
      // Save the email as a conversation message
      const message = await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: leadInfo.leadId,
        senderType: 'lead',
        content: event['stripped-text'] || event['body-plain'],
        metadata: {
          emailSubject: event.subject,
          sender: event.sender,
          recipient: event.recipient,
          htmlContent: event['stripped-html'] || event['body-html']
        }
      });

      // Trigger AI auto-response if enabled
      await this.processAutoResponse(leadInfo.leadId, conversation.id, message);

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
      const conversation = await this.getOrCreateConversation(lead.id, 'SMS Conversation');
      
      // Save SMS as conversation message
      const message = await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: lead.id,
        senderType: 'lead',
        content: Body,
        metadata: {
          messageType: 'sms',
          from: From,
          to: To,
          messageSid: MessageSid
        }
      });

      // Process auto-response
      const aiResponse = await this.processAutoResponse(lead.id, conversation.id, message);
      
      // Send SMS reply if AI generated a response
      if (aiResponse) {
        const smsService = await import('./twilio');
        await smsService.sendSMS(From, aiResponse, {
          conversationId: conversation.id,
          leadId: lead.id
        });
      }

      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    } catch (error) {
      console.error('Inbound SMS processing error:', error);
      res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error processing message</Message></Response>');
    }
  }

  private static verifyMailgunSignature(event: MailgunInboundEvent): boolean {
    // In production, implement proper Mailgun signature verification
    // For now, just check if required fields exist
    return !!(event.sender && event.timestamp && event.token);
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

  private static async getOrCreateConversation(leadId: string, subject: string) {
    // Try to find existing conversation for this lead
    const conversations = await storage.getConversationsByLead(leadId);
    
    if (conversations.length > 0) {
      // Return most recent conversation
      return conversations[0];
    }

    // Create new conversation
    return await storage.createConversation({
      leadId,
      subject: subject || 'Email Conversation',
      status: 'active',
      assignedAgentId: null
    });
  }

  private static async processAutoResponse(leadId: string, conversationId: string, incomingMessage: any): Promise<string | null> {
    try {
      // Get lead and conversation context
      const lead = await storage.getLead(leadId);
      const conversation = await storage.getConversation(conversationId);
      const recentMessages = await storage.getConversationMessages(conversationId, 5);

      if (!lead || !conversation) {
        return null;
      }

      // Check if auto-response is enabled for this lead/campaign
      const shouldAutoRespond = await this.shouldGenerateAutoResponse(lead, conversation);
      if (!shouldAutoRespond) {
        return null;
      }

      // Create automotive context
      const context = AutomotivePromptService.createConversationContext(
        lead.name,
        lead.vehicleInterest,
        incomingMessage.content,
        recentMessages.map(m => m.content)
      );

      // Generate AI response using OpenRouter
      const aiResponse = await this.generateAIResponse(context, incomingMessage.content);
      
      if (aiResponse) {
        // Save AI response
        await storage.createConversationMessage({
          conversationId,
          senderId: 'ai-agent',
          senderType: 'ai',
          content: aiResponse,
          metadata: {
            autoGenerated: true,
            context
          }
        });

        // Send via live conversation service if connected
        if (liveConversationService) {
          await liveConversationService.sendMessageToLead(leadId, conversationId, aiResponse, 'ai');
        }
      }

      return aiResponse;
    } catch (error) {
      console.error('Auto-response processing error:', error);
      return null;
    }
  }

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

  private static async generateAIResponse(context: any, messageContent: string): Promise<string | null> {
    try {
      const config = AutomotivePromptService.getDefaultDealershipConfig();
      const systemPrompt = AutomotivePromptService.generateEnhancedSystemPrompt(
        config,
        context,
        {
          useStraightTalkingStyle: true,
          season: this.getCurrentSeason(),
          brand: this.extractBrandFromContext(context)
        }
      );

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'OneKeel Swarm - Email Auto Response'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: messageContent }
          ],
          max_tokens: 300,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (error) {
      console.error('AI response generation error:', error);
      return null;
    }
  }

  private static getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private static extractBrandFromContext(context: any): string | undefined {
    const text = (context.vehicleInterest || '').toLowerCase();
    const brands = ['honda', 'toyota', 'ford', 'chevrolet', 'jeep'];
    return brands.find(brand => text.includes(brand));
  }
}