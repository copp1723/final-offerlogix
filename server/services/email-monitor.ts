import imaps, { ImapSimple } from 'imap-simple';
import { simpleParser, ParsedMail } from 'mailparser';
import { storage } from '../storage';
import { liveConversationService } from './live-conversation';
import { AutomotivePromptService } from './automotive-prompts';

interface EmailTriggerRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: {
    from?: string | string[];
    subject?: string | RegExp;
    body?: string | RegExp;
    hasAttachment?: boolean;
  };
  actions: {
    createLead: boolean;
    assignCampaign?: string;
    addTags?: string[];
    setSource?: string;
    setPriority?: 'low' | 'normal' | 'high' | 'urgent';
    autoRespond?: boolean;
  };
}

interface LeadData {
  email: string;
  name?: string;
  phone?: string;
  vehicleInterest?: string;
  isFromAI?: 0 | 1;
}

export class EmailMonitorService {
  private connection: ImapSimple | null = null;
  private triggerRules: EmailTriggerRule[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.loadDefaultTriggerRules();
  }

  async start() {
    if (this.isRunning) {
      console.log('Email monitor already running');
      return;
    }

    // Check if IMAP configuration is available
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
      console.log('Email monitor not started - IMAP configuration missing');
      return;
    }

    const config = {
      imap: {
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST,
        port: Number(process.env.IMAP_PORT) || 993,
        tls: true,
        tlsOptions: {
          rejectUnauthorized: false
        },
        authTimeout: 3000,
        connTimeout: 10000,
      },
    };

    try {
      this.connection = await imaps.connect(config);
      await this.connection.openBox('INBOX');
      this.isRunning = true;
      console.log('Email monitor connected and listening');
      
      // Start periodic checking for new emails
      this.startPeriodicCheck();
      
      // Set up real-time monitoring if supported
      if (this.connection.imap) {
        this.connection.imap.on('mail', (numNewMails: number) => {
          this.handleNewMail(numNewMails);
        });
      }
    } catch (error) {
      console.error('Failed to start email monitor:', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.connection) {
      this.connection.end();
      this.connection = null;
    }
    
    console.log('Email monitor stopped');
  }

  private startPeriodicCheck() {
    // Check for new emails every 60 seconds
    this.checkInterval = setInterval(() => {
      this.checkForNewEmails();
    }, 60000);
  }

  private async checkForNewEmails() {
    if (!this.connection || !this.isRunning) return;

    try {
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = { 
        bodies: ['HEADER', 'TEXT', ''], 
        markSeen: false,
        struct: true 
      };
      
      const messages = await this.connection.search(searchCriteria, fetchOptions);
      
      if (messages.length > 0) {
        console.log(`Processing ${messages.length} new emails`);
        await this.processEmails(messages);
      }
    } catch (error) {
      console.error('Error checking for new emails:', error);
    }
  }

  private async handleNewMail(numNewMails: number) {
    console.log(`New mail notification: ${numNewMails} emails`);
    await this.checkForNewEmails();
  }

  private async processEmails(messages: any[]) {
    for (const message of messages) {
      try {
        const all = message.parts.find((part: any) => part.which === '');
        if (!all?.body) continue;

        const parsed = await simpleParser(all.body);
        const result = await this.processEmail(parsed);
        
        if (result.processed) {
          const uid = message.attributes.uid;
          await this.markSeen(uid);
        }
      } catch (error) {
        console.error('Error processing email:', error);
      }
    }
  }

  private async markSeen(uid: number) {
    if (!this.connection) return;
    await new Promise<void>((resolve, reject) => {
      try {
        this.connection!.addFlags(uid, '\\Seen', (err) => {
          if (err) reject(err); else resolve();
        });
      } catch (e) { reject(e as any); }
    });
  }

  private async processEmail(email: ParsedMail): Promise<{ processed: boolean; leadId?: string }> {
    const fromAddress = email.from?.value[0]?.address || '';
    const fromName = email.from?.value[0]?.name || '';
    const subject = email.subject || '';
    const textBody = email.text || '';

    console.log(`Processing email from: ${fromAddress}, Subject: ${subject.substring(0, 50)}`);

    // Check if this is a reply to existing conversation
    const existingLead = await this.findLeadByEmail(fromAddress);
    if (existingLead) {
      await this.handleEmailReply(existingLead, email);
      return { processed: true, leadId: existingLead.id };
    }

    // Check trigger rules for new leads
    const matchedRule = this.findMatchingRule(email);
    if (!matchedRule) {
      console.log('No matching trigger rule found');
      return { processed: false };
    }

    console.log(`Email matched rule: ${matchedRule.name}`);

    // Extract lead data
    const leadData = this.extractLeadData(email, matchedRule);

    // Create new lead
    if (matchedRule.actions.createLead) {
      const lead = await this.createLead(leadData);
      console.log(`Created new lead: ${lead.id}`);

      // Apply rule actions
      await this.applyRuleActions(lead, matchedRule);

      // Send auto-response if enabled
      if (matchedRule.actions.autoRespond) {
        await this.sendAutoResponse(lead, email);
      }

      return { processed: true, leadId: lead.id };
    }

    return { processed: true };
  }

  private async handleEmailReply(lead: any, email: ParsedMail) {
    try {
      // Find or create conversation
      const conversations = await storage.getConversationsByLead(lead.id);
      let conversation = conversations.find(c => c.status === 'active');
      
      if (!conversation) {
        conversation = await storage.createConversation({
          leadId: lead.id,
          subject: `Email: ${email.subject}`,
          status: 'active'
        });
      }

      // Add email message to conversation
      const message = await storage.createConversationMessage({
        conversationId: conversation.id,
        senderId: lead.id,
        messageType: 'email',
        content: email.text || email.html || '',
        isFromAI: 0
      });

      // Generate AI auto-response using OpenRouter
      await this.generateAIResponse(lead, conversation, message);

    } catch (error) {
      console.error('Error handling email reply:', error);
    }
  }

  private async generateAIResponse(lead: any, conversation: any, incomingMessage: any) {
    try {
      // Create automotive context
      const context = AutomotivePromptService.createConversationContext(
        lead.name || 'Customer',
        lead.vehicleInterest,
        incomingMessage.content,
        []
      );

      // Generate enhanced system prompt
      const config = AutomotivePromptService.getDefaultDealershipConfig();
      const systemPrompt = AutomotivePromptService.generateEnhancedSystemPrompt(
        config,
        context,
        {
          season: this.getCurrentSeason(),
          useStraightTalkingStyle: true,
          brand: this.extractBrandFromContent(incomingMessage.content, lead.vehicleInterest)
        }
      );

      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'X-Title': 'OneKeel Swarm - Email Response'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: incomingMessage.content }
          ],
          max_tokens: 400,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponseContent = data.choices?.[0]?.message?.content;

      if (aiResponseContent) {
        // Save AI response to conversation
        const aiMessage = await storage.createConversationMessage({
          conversationId: conversation.id,
          senderId: 'ai-agent',
          messageType: 'email',
          content: aiResponseContent,
          isFromAI: 1
        });

        // Send email response using Mailgun
        await this.sendEmailResponse(lead.email, aiResponseContent, `Re: ${incomingMessage.content.split('\n')[0] || 'Email Response'}`);

        // Notify via WebSocket if connected
        if (liveConversationService) {
          await liveConversationService.sendMessageToLead(lead.id, conversation.id, aiResponseContent, 'email');
        }
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
    }
  }

  private async sendEmailResponse(toEmail: string, content: string, subject: string) {
    try {
      const mailgunService = await import('./mailgun');
      await mailgunService.sendCampaignEmail(
        toEmail,
        subject,
        content,
        {},
        { isAutoResponse: true }
      );
    } catch (error) {
      console.error('Error sending email response:', error);
    }
  }

  private findMatchingRule(email: ParsedMail): EmailTriggerRule | null {
    const fromAddress = email.from?.value[0]?.address || '';
    const subject = email.subject || '';
    const body = email.text || email.html || '';

    for (const rule of this.triggerRules) {
      if (!rule.enabled) continue;

      let matches = true;

      // Check from condition
      if (rule.conditions.from) {
        const fromPatterns = Array.isArray(rule.conditions.from) 
          ? rule.conditions.from 
          : [rule.conditions.from];
        
        matches = fromPatterns.some(pattern => 
          fromAddress.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (!matches) continue;
      }

      // Check subject condition
      if (rule.conditions.subject) {
        if (rule.conditions.subject instanceof RegExp) {
          matches = rule.conditions.subject.test(subject);
        } else {
          matches = subject.toLowerCase().includes(rule.conditions.subject.toLowerCase());
        }
        
        if (!matches) continue;
      }

      // Check body condition
      if (rule.conditions.body) {
        if (rule.conditions.body instanceof RegExp) {
          matches = rule.conditions.body.test(body);
        } else {
          matches = body.toLowerCase().includes(rule.conditions.body.toLowerCase());
        }
        
        if (!matches) continue;
      }

      return rule;
    }

    return null;
  }

  private extractLeadData(email: ParsedMail, rule: EmailTriggerRule): LeadData {
    const fromAddress = email.from?.value[0]?.address || '';
    const fromName = email.from?.value[0]?.name || '';
    const content = email.text || '';
    
    // Extract phone number
    const phoneRegex = /(\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;
    const phoneMatch = content.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[0] : undefined;

    // Extract vehicle interest
    const vehicleKeywords = ['honda', 'toyota', 'ford', 'chevrolet', 'jeep', 'bmw', 'mercedes', 'audi', 'car', 'truck', 'suv'];
    const vehicleInterest = vehicleKeywords.find(keyword => 
      content.toLowerCase().includes(keyword)
    );

    return {
      email: fromAddress,
      name: fromName || this.extractNameFromEmail(fromAddress),
      phone,
      vehicleInterest
    };
  }

  private extractNameFromEmail(email: string): string {
    const [localPart] = email.split('@');
    return localPart
      .split(/[._-]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async findLeadByEmail(email: string): Promise<any> {
    try {
      return await storage.getLeadByEmail(email);
    } catch (error) {
      console.error('Error finding lead by email:', error);
      return null;
    }
  }

  private async createLead(data: LeadData) {
    return await storage.createLead({
      firstName: data.name || 'Email',
      lastName: 'Lead',
      email: data.email,
      phone: data.phone,
      leadSource: 'email',
      status: 'new',
      vehicleInterest: data.vehicleInterest,
      qualificationScore: 0,
      // metadata field removed from leads schema
    });
  }

  private async applyRuleActions(lead: any, rule: EmailTriggerRule) {
    try {
      const updates: any = {};

      if (rule.actions.assignCampaign) {
        updates.campaignId = rule.actions.assignCampaign;
      }

      if (rule.actions.setPriority) {
        // Priority would be handled in separate field if added to schema
        updates.status = rule.actions.setPriority;
      }

      if (rule.actions.addTags) {
        const existingTags = lead.tags || [];
        const tagSet = new Set([...existingTags, ...rule.actions.addTags]);
        updates.tags = Array.from(tagSet);
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateLead(lead.id, updates);
      }
    } catch (error) {
      console.error('Error applying rule actions:', error);
    }
  }

  private async sendAutoResponse(lead: any, email: ParsedMail) {
    // This would be implemented with the AI response system
    console.log(`Would send auto-response to ${lead.email}`);
  }

  private getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private extractBrandFromContent(content: string, vehicleInterest?: string): string | undefined {
    const text = (content + ' ' + (vehicleInterest || '')).toLowerCase();
    const brands = ['honda', 'toyota', 'ford', 'chevrolet', 'jeep', 'bmw'];
    return brands.find(brand => text.includes(brand));
  }

  private loadDefaultTriggerRules() {
    this.triggerRules = [
      {
        id: 'automotive-inquiry',
        name: 'Automotive Inquiry',
        enabled: true,
        conditions: {
          subject: 'car|auto|vehicle|financing|loan',
          body: 'interested|financing|loan|car|auto'
        },
        actions: {
          createLead: true,
          setSource: 'email-inquiry',
          setPriority: 'high',
          autoRespond: true
        }
      },
      {
        id: 'general-inquiry',
        name: 'General Business Inquiry',
        enabled: true,
        conditions: {
          subject: 'inquiry|information|question',
          body: 'help|information|question'
        },
        actions: {
          createLead: true,
          setSource: 'email-general',
          setPriority: 'normal',
          autoRespond: true
        }
      }
    ];
  }

  // Public methods for API integration
  getRules(): EmailTriggerRule[] {
    return this.triggerRules;
  }

  addRule(rule: EmailTriggerRule): void {
    this.triggerRules.push(rule);
    console.log(`Added email rule: ${rule.name}`);
  }

  removeRule(ruleId: string): boolean {
    const initialLength = this.triggerRules.length;
    this.triggerRules = this.triggerRules.filter(r => r.id !== ruleId);
    return this.triggerRules.length < initialLength;
  }

  getStatus() {
    return {
      running: this.isRunning,
      connected: this.connection !== null,
      ruleCount: this.triggerRules.length,
      enabledRules: this.triggerRules.filter(r => r.enabled).length
    };
  }
}

export const emailMonitorService = new EmailMonitorService();