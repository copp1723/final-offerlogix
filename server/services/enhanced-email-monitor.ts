import imaps, { ImapSimple } from 'imap-simple';
import { simpleParser } from 'mailparser';
import { storage } from '../storage';
import { webSocketService } from './websocket';

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
    triggerCampaign?: string;
  };
}

interface CampaignTrigger {
  campaignId: string;
  conditions: {
    keywords: string[];
    senderDomain?: string;
    vehicleInterest?: string;
  };
  actions: {
    assignLead: boolean;
    sendWelcomeEmail: boolean;
    scheduleFollowUp: boolean;
    followUpDelayHours: number;
  };
}

interface LeadData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  vehicleInterest?: string;
  metadata?: any;
  source?: string;
  priority?: string;
  tags?: string[];
}

export class EnhancedEmailMonitor {
  private connection: ImapSimple | null = null;
  private triggerRules: EmailTriggerRule[] = [];
  private campaignTriggers: CampaignTrigger[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastProcessedUid = 0;

  constructor() {
    this.loadDefaultTriggerRules();
    this.loadCampaignTriggers();
  }

  async start() {
    if (this.isRunning) {
      console.log('Enhanced email monitor already running');
      return;
    }

    // Check if IMAP configuration is available
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
      console.log('Enhanced email monitor not started - IMAP configuration missing');
      return;
    }

    const config = {
      imap: {
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST,
        port: Number(process.env.IMAP_PORT) || 993,
        tls: true,
        authTimeout: 3000,
        connTimeout: 10000,
        tlsOptions: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      },
    };

    try {
      this.connection = await imaps.connect(config);
      await this.connection.openBox('INBOX');
      this.isRunning = true;
      console.log('Enhanced email monitor connected and listening');
      
      // Start periodic checking for new emails
      this.startPeriodicCheck();
      
      // Set up real-time monitoring if supported
      if (this.connection.imap) {
        this.connection.imap.on('mail', (numNewMails: number) => {
          this.handleNewMail(numNewMails);
        });
      }
    } catch (error) {
      console.error('Failed to start enhanced email monitor:', error);
      // Don't throw error to prevent server startup failure
      console.log('Continuing without email monitoring...');
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
    
    console.log('Enhanced email monitor stopped');
  }

  private startPeriodicCheck() {
    // Check for new emails every 30 seconds for enhanced responsiveness
    this.checkInterval = setInterval(() => {
      this.checkForNewEmails();
    }, 30000);
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
      
      for (const message of messages) {
        await this.processEmailMessage(message);
      }
    } catch (error) {
      console.error('Error checking for new emails:', error);
    }
  }

  private async handleNewMail(numNewMails: number) {
    console.log(`Enhanced email monitor: ${numNewMails} new emails received`);
    await this.checkForNewEmails();
  }

  private async processEmailMessage(message: any) {
    try {
      const all = message.parts.find((part: any) => part.which === '');
      if (!all || !all.body) return;

      const parsed: ParsedMail = await simpleParser(all.body);
      
      // Extract email details
      const emailData = {
        from: parsed.from?.value?.[0]?.address || '',
        subject: parsed.subject || '',
        text: parsed.text || '',
        html: parsed.html || '',
        date: parsed.date || new Date(),
        messageId: parsed.messageId || '',
        hasAttachments: (parsed.attachments?.length || 0) > 0
      };

      console.log(`Processing email: ${emailData.subject} from ${emailData.from}`);

      // Apply trigger rules
      for (const rule of this.triggerRules.filter(r => r.enabled)) {
        if (this.matchesRule(emailData, rule)) {
          await this.executeRuleActions(emailData, rule);
        }
      }

      // Apply campaign triggers
      for (const trigger of this.campaignTriggers) {
        if (this.matchesCampaignTrigger(emailData, trigger)) {
          await this.executeCampaignTrigger(emailData, trigger);
        }
      }

      // Mark as seen after processing
      if (this.connection) {
        await this.connection.addFlags(message.attributes.uid, ['\\Seen']);
      }

    } catch (error) {
      console.error('Error processing email message:', error);
    }
  }

  private matchesRule(emailData: any, rule: EmailTriggerRule): boolean {
    const { conditions } = rule;

    // Check from condition
    if (conditions.from) {
      const fromConditions = Array.isArray(conditions.from) ? conditions.from : [conditions.from];
      const matches = fromConditions.some(condition => 
        emailData.from.toLowerCase().includes(condition.toLowerCase())
      );
      if (!matches) return false;
    }

    // Check subject condition
    if (conditions.subject) {
      const subjectPattern = conditions.subject instanceof RegExp 
        ? conditions.subject 
        : new RegExp(conditions.subject, 'i');
      if (!subjectPattern.test(emailData.subject)) return false;
    }

    // Check body condition
    if (conditions.body) {
      const bodyPattern = conditions.body instanceof RegExp 
        ? conditions.body 
        : new RegExp(conditions.body, 'i');
      const bodyText = emailData.text || emailData.html || '';
      if (!bodyPattern.test(bodyText)) return false;
    }

    // Check attachment condition
    if (conditions.hasAttachment !== undefined) {
      if (conditions.hasAttachment !== emailData.hasAttachments) return false;
    }

    return true;
  }

  private matchesCampaignTrigger(emailData: any, trigger: CampaignTrigger): boolean {
    const { conditions } = trigger;
    const bodyText = (emailData.text || emailData.html || '').toLowerCase();
    const subject = emailData.subject.toLowerCase();

    // Check keywords
    const hasKeywords = conditions.keywords.some(keyword => 
      bodyText.includes(keyword.toLowerCase()) || subject.includes(keyword.toLowerCase())
    );
    if (!hasKeywords) return false;

    // Check sender domain
    if (conditions.senderDomain) {
      const emailDomain = emailData.from.split('@')[1];
      if (emailDomain !== conditions.senderDomain) return false;
    }

    // Check vehicle interest
    if (conditions.vehicleInterest) {
      const vehiclePattern = new RegExp(conditions.vehicleInterest, 'i');
      if (!vehiclePattern.test(bodyText + ' ' + subject)) return false;
    }

    return true;
  }

  private async executeRuleActions(emailData: any, rule: EmailTriggerRule) {
    console.log(`Executing actions for rule: ${rule.name}`);
    
    if (rule.actions.createLead) {
      await this.createLeadFromEmail(emailData, rule);
    }

    if (rule.actions.autoRespond) {
      await this.sendAutoResponse(emailData, rule);
    }

    if (rule.actions.triggerCampaign) {
      await this.triggerCampaignExecution(emailData, rule.actions.triggerCampaign);
    }
  }

  private async executeCampaignTrigger(emailData: any, trigger: CampaignTrigger) {
    console.log(`Executing campaign trigger for campaign: ${trigger.campaignId}`);

    if (trigger.actions.assignLead) {
      const leadData = await this.createLeadFromEmail(emailData, null, trigger.campaignId);
      
      if (trigger.actions.sendWelcomeEmail && leadData) {
        await this.sendWelcomeEmail(leadData, trigger.campaignId);
      }

      if (trigger.actions.scheduleFollowUp && leadData) {
        await this.scheduleFollowUp(leadData, trigger.followUpDelayHours);
      }
    }
  }

  private async createLeadFromEmail(emailData: any, rule: EmailTriggerRule | null, campaignId?: string): Promise<any> {
    try {
      // Extract contact information from email
      const leadData: LeadData = {
        email: emailData.from,
        source: rule?.actions.setSource || 'email_inquiry',
        priority: rule?.actions.setPriority || 'normal',
        tags: rule?.actions.addTags || [],
        vehicleInterest: this.extractVehicleInterest(emailData.text + ' ' + emailData.subject),
        metadata: {
          originalSubject: emailData.subject,
          receivedAt: emailData.date,
          messageId: emailData.messageId,
          hasAttachments: emailData.hasAttachments
        }
      };

      // Try to extract name from email address or signature
      const nameMatch = emailData.from.match(/^([^@]+)@/);
      if (nameMatch) {
        const namePart = nameMatch[1].replace(/[._]/g, ' ');
        const nameWords = namePart.split(' ').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        );
        leadData.firstName = nameWords[0];
        if (nameWords.length > 1) {
          leadData.lastName = nameWords.slice(1).join(' ');
        }
      }

      // Assign campaign if specified
      if (campaignId) {
        leadData.metadata.assignedCampaignId = campaignId;
      }

      // Check if lead already exists
      const existingLeads = await storage.getLeadsByEmail(leadData.email);
      if (existingLeads.length > 0) {
        console.log(`Lead already exists for email: ${leadData.email}`);
        // Update existing lead with new metadata
        const existingLead = existingLeads[0];
        await storage.updateLead(existingLead.id, {
          ...leadData.metadata,
          lastContactAt: new Date()
        });
        return existingLead;
      }

      // Create new lead
      const newLead = await storage.createLead({
        email: leadData.email,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        vehicleInterest: leadData.vehicleInterest,
        leadSource: leadData.source,
        status: 'new',
        tags: leadData.tags,
        notes: `Created from email: ${emailData.subject}`,
        campaignId: campaignId || null
      });

      console.log(`Created new lead from email: ${newLead.id}`);

      // Broadcast new lead via WebSocket
      webSocketService.broadcast({
        type: 'new_lead',
        lead: newLead
      });

      return newLead;

    } catch (error) {
      console.error('Error creating lead from email:', error);
      return null;
    }
  }

  private extractVehicleInterest(text: string): string {
    const vehiclePatterns = [
      /(\d{4})\s+(Toyota|Honda|Ford|Chevrolet|BMW|Mercedes|Audi|Lexus|Nissan|Hyundai|Kia|Volkswagen|Subaru|Mazda|Volvo|Acura|Infiniti|Cadillac|Lincoln|Buick|GMC|Jeep|Chrysler|Dodge|Ram)\s+([A-Za-z0-9\s]+)/gi,
      /(Toyota|Honda|Ford|Chevrolet|BMW|Mercedes|Audi|Lexus|Nissan|Hyundai|Kia|Volkswagen|Subaru|Mazda|Volvo|Acura|Infiniti|Cadillac|Lincoln|Buick|GMC|Jeep|Chrysler|Dodge|Ram)\s+([A-Za-z0-9\s]+)/gi
    ];

    for (const pattern of vehiclePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    return '';
  }

  private async sendAutoResponse(emailData: any, rule: EmailTriggerRule) {
    try {
      // Generate automotive-specific auto-response
      const responseContent = this.generateAutoResponse(emailData, rule);
      
      // Send actual auto-response via Mailgun
      const { sendCampaignEmail } = await import('./mailgun');
      const sent = await sendCampaignEmail(
        emailData.from,
        responseContent.subject,
        responseContent.content,
        {},
        { isAutoResponse: true }
      );
      
      if (sent) {
        console.log(`Auto-response sent to ${emailData.from}: ${responseContent.subject}`);
      } else {
        console.error(`Failed to send auto-response to ${emailData.from}`);
      }
    } catch (error) {
      console.error('Error sending auto-response:', error);
    }
  }

  private generateAutoResponse(emailData: any, rule: EmailTriggerRule): { subject: string; content: string } {
    const subject = `Re: ${emailData.subject}`;
    const content = `
Thank you for your interest in our vehicles!

We've received your inquiry and one of our automotive specialists will contact you within 24 hours to discuss your vehicle needs.

In the meantime, feel free to browse our current inventory and special offers on our website.

Best regards,
OneKeel Swarm Team

---
This is an automated response. Please do not reply to this email directly.
    `.trim();

    return { subject, content };
  }

  private async triggerCampaignExecution(emailData: any, campaignId: string) {
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        console.error(`Campaign not found: ${campaignId}`);
        return;
      }

      console.log(`Triggering campaign execution: ${campaign.name}`);
      
      // Execute campaign through orchestrator
      const { CampaignOrchestrator } = await import('./campaign-execution/CampaignOrchestrator');
      const orchestrator = new CampaignOrchestrator();
      
      const result = await orchestrator.executeCampaign({
        campaignId: campaignId,
        testMode: false,
        maxLeadsPerBatch: 10
      });
      
      console.log(`Campaign execution result:`, result);
    } catch (error) {
      console.error('Error triggering campaign execution:', error);
    }
  }

  private async sendWelcomeEmail(leadData: any, campaignId: string) {
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        console.error(`Campaign not found for welcome email: ${campaignId}`);
        return;
      }

      // Send first template from campaign as welcome email
      const { sendCampaignEmail } = await import('./mailgun');
      
      const welcomeContent = `
        <h2>Welcome to OneKeel Swarm!</h2>
        <p>Thank you for your interest in our automotive services.</p>
        <p>We've received your inquiry about: <strong>${leadData.vehicleInterest || 'vehicles'}</strong></p>
        <p>A member of our team will contact you within 24 hours to discuss your automotive needs.</p>
        <p>Best regards,<br>OneKeel Swarm Team</p>
      `;
      
      const sent = await sendCampaignEmail(
        leadData.email,
        `Welcome to OneKeel Swarm - ${leadData.firstName || 'Valued Customer'}`,
        welcomeContent
      );
      
      if (sent) {
        console.log(`Welcome email sent to lead: ${leadData.email}`);
      } else {
        console.error(`Failed to send welcome email to: ${leadData.email}`);
      }
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  private async scheduleFollowUp(leadData: any, delayHours: number) {
    try {
      // Use campaign scheduler to schedule follow-up
      const { campaignScheduler } = await import('./campaign-scheduler');
      
      const followUpDate = new Date();
      followUpDate.setHours(followUpDate.getHours() + delayHours);
      
      // Create a follow-up task (simplified version)
      console.log(`Follow-up scheduled for lead: ${leadData.email} at ${followUpDate.toISOString()}`);
      
      // In a more sophisticated system, this would create calendar events or tasks
      // For now, we'll use the existing notification system
      setTimeout(async () => {
        try {
          const { sendCampaignEmail } = await import('./mailgun');
          const followUpContent = `
            <h2>Following up on your automotive inquiry</h2>
            <p>Hi ${leadData.firstName || 'there'},</p>
            <p>We wanted to follow up on your recent inquiry about ${leadData.vehicleInterest || 'our vehicles'}.</p>
            <p>Are you ready to schedule a test drive or would you like more information?</p>
            <p>Please reply to this email or call us to continue the conversation.</p>
            <p>Best regards,<br>OneKeel Swarm Team</p>
          `;
          
          await sendCampaignEmail(
            leadData.email,
            `Follow-up: Your ${leadData.vehicleInterest || 'Vehicle'} Inquiry`,
            followUpContent
          );
          
          console.log(`Follow-up email sent to: ${leadData.email}`);
        } catch (error) {
          console.error('Error sending follow-up email:', error);
        }
      }, delayHours * 60 * 60 * 1000); // Convert hours to milliseconds
      
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
    }
  }

  private loadDefaultTriggerRules() {
    this.triggerRules = [
      {
        id: 'automotive-inquiry',
        name: 'Automotive Inquiry Detector',
        enabled: true,
        conditions: {
          subject: /(test drive|vehicle|car|auto|dealership|pricing|quote)/i,
          body: /(interested|pricing|quote|appointment|test drive|vehicle|car)/i
        },
        actions: {
          createLead: true,
          setSource: 'email_inquiry',
          setPriority: 'normal',
          autoRespond: true,
          addTags: ['email_inquiry', 'automotive']
        }
      },
      {
        id: 'urgent-service',
        name: 'Urgent Service Request',
        enabled: true,
        conditions: {
          subject: /(urgent|emergency|asap|immediate)/i,
          body: /(service|repair|maintenance|problem|urgent|emergency)/i
        },
        actions: {
          createLead: true,
          setSource: 'service_request',
          setPriority: 'urgent',
          autoRespond: true,
          addTags: ['service', 'urgent']
        }
      },
      {
        id: 'new-vehicle-interest',
        name: 'New Vehicle Interest',
        enabled: true,
        conditions: {
          body: /(2024|2025|new|latest|model|purchase|buy)/i
        },
        actions: {
          createLead: true,
          setSource: 'new_vehicle_inquiry',
          setPriority: 'high',
          autoRespond: true,
          addTags: ['new_vehicle', 'purchase_intent']
        }
      }
    ];
  }

  private loadCampaignTriggers() {
    this.campaignTriggers = [
      {
        campaignId: 'welcome-series',
        conditions: {
          keywords: ['welcome', 'new customer', 'first time'],
          vehicleInterest: '2024|2025'
        },
        actions: {
          assignLead: true,
          sendWelcomeEmail: true,
          scheduleFollowUp: true,
          followUpDelayHours: 24
        }
      }
    ];
  }

  // Public methods for rule management
  addTriggerRule(rule: EmailTriggerRule) {
    this.triggerRules.push(rule);
  }

  removeTriggerRule(ruleId: string): boolean {
    const initialLength = this.triggerRules.length;
    this.triggerRules = this.triggerRules.filter(rule => rule.id !== ruleId);
    return this.triggerRules.length < initialLength;
  }

  getTriggerRules(): EmailTriggerRule[] {
    return [...this.triggerRules];
  }

  getStatus() {
    return {
      running: this.isRunning,
      connected: this.connection !== null,
      ruleCount: this.triggerRules.length,
      enabledRules: this.triggerRules.filter(r => r.enabled).length,
      campaignTriggers: this.campaignTriggers.length
    };
  }
}

export const enhancedEmailMonitor = new EnhancedEmailMonitor();