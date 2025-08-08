import { storage } from '../../storage';
// Removed mailgunService import - using dynamic import instead
import type { Campaign, Lead } from '@shared/schema';

export interface ProcessingOptions {
  batchSize?: number;
  delayBetweenEmails?: number;
  testMode?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  emailsSent: number;
  emailsFailed: number;
  errors: string[];
  executionId: string;
}

export class ExecutionProcessor {
  
  async processEmailSequence(
    campaign: Campaign,
    leads: Lead[],
    templateIndex: number = 0,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const { 
      batchSize = 50, 
      delayBetweenEmails = 1000, 
      testMode = false 
    } = options;

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const errors: string[] = [];
    let emailsSent = 0;
    let emailsFailed = 0;

    try {
      // Get campaign templates (they're already parsed objects, not JSON strings)
      let templates: any[] = [];
      
      if (Array.isArray(campaign.templates)) {
        templates = campaign.templates;
      } else if (typeof campaign.templates === 'string') {
        try {
          templates = JSON.parse(campaign.templates);
        } catch (error) {
          throw new Error('Invalid email templates JSON in campaign');
        }
      } else {
        templates = [];
      }
      
      if (!Array.isArray(templates) || templates.length === 0) {
        throw new Error('Campaign has no email templates');
      }

      if (templateIndex >= templates.length) {
        throw new Error(`Template index ${templateIndex} is out of range`);
      }

      const template = templates[templateIndex];
      
      // Process leads in batches
      const batches = this.createBatches(leads, batchSize);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} leads) - Template: ${template.title || 'Untitled'}`);
        
        const batchResults = await Promise.allSettled(
          batch.map(lead => this.sendEmailToLead(campaign, lead, template, testMode))
        );

        // Process batch results
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const lead = batch[i];

          if (result.status === 'fulfilled' && result.value.success) {
            emailsSent++;
            
            // Update lead status
            try {
              await storage.updateLead(lead.id, { 
                status: 'contacted'
              });
            } catch (updateError) {
              console.error(`Failed to update lead ${lead.id}:`, updateError);
            }
          } else {
            emailsFailed++;
            const errorMessage = result.status === 'rejected' 
              ? result.reason 
              : result.value.error || 'Unknown error';
            errors.push(`Failed to send email to ${lead.email}: ${errorMessage}`);
          }
        }

        // Add delay between batches (except for the last batch)
        if (batchIndex < batches.length - 1) {
          await this.delay(delayBetweenEmails);
        }
      }

      // Update campaign metrics
      try {
        const currentMetrics = {}; // Note: performanceMetrics field doesn't exist in schema
        
        const updatedMetrics = {
          ...currentMetrics,
          totalEmailsSent: (currentMetrics.totalEmailsSent || 0) + emailsSent,
          lastExecutionDate: new Date(),
          executionCount: (currentMetrics.executionCount || 0) + 1,
          templatesSent: {
            ...currentMetrics.templatesSent,
            [templateIndex]: (currentMetrics.templatesSent?.[templateIndex] || 0) + emailsSent
          }
        };

        await storage.updateCampaign(campaign.id, {
          status: 'active'
        });
      } catch (updateError) {
        console.error('Failed to update campaign metrics:', updateError);
        errors.push('Failed to update campaign metrics');
      }

      return {
        success: errors.length === 0 || emailsSent > 0,
        emailsSent,
        emailsFailed,
        errors,
        executionId
      };

    } catch (error) {
      console.error('Email sequence processing failed:', error);
      return {
        success: false,
        emailsSent: 0,
        emailsFailed: leads.length,
        errors: [error instanceof Error ? error.message : 'Unknown processing error'],
        executionId
      };
    }
  }

  private async sendEmailToLead(
    campaign: Campaign, 
    lead: Lead, 
    template: any, 
    testMode: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Personalize email content
      const personalizedSubject = this.personalizeContent(template.subject || campaign.name, lead);
      const personalizedContent = this.personalizeContent(template.content || template.body || '', lead);

      const emailData = {
        to: lead.email,
        subject: testMode ? `[TEST] ${personalizedSubject}` : personalizedSubject,
        html: personalizedContent,
        from: `OneKeel Swarm <${process.env.MAILGUN_FROM_EMAIL || 'swarm@mg.watchdogai.us'}>`
      };

      // Import the mailgun service dynamically
      const { sendCampaignEmail } = await import('../mailgun');
      const success = await sendCampaignEmail(
        emailData.to,
        emailData.subject,
        emailData.html
      );
      
      const result = { success, error: success ? null : 'Failed to send email' };
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      console.log(`✅ Email sent to ${lead.email} for campaign ${campaign.name}`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Failed to send email to ${lead.email}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown email error' 
      };
    }
  }

  private personalizeContent(content: string, lead: Lead): string {
    if (!content) return '';

    return content
      .replace(/\{\{firstName\}\}/g, lead.firstName || 'Customer')
      .replace(/\{\{first_name\}\}/g, lead.firstName || 'Customer')
      .replace(/\{\{lastName\}\}/g, lead.lastName || '')
      .replace(/\{\{last_name\}\}/g, lead.lastName || '')
      .replace(/\{\{email\}\}/g, lead.email)
      .replace(/\{\{vehicleInterest\}\}/g, lead.vehicleInterest || 'our vehicles')
      .replace(/\{\{vehicle_interest\}\}/g, lead.vehicleInterest || 'our vehicles')
      .replace(/\{\{phone\}\}/g, lead.phone || '')
      .replace(/\{\{budget\}\}/g, 'Not specified') // Note: budget field doesn't exist in Lead schema
      .replace(/\{\{timeframe\}\}/g, 'Not specified') // Note: timeframe field doesn't exist in Lead schema
      .replace(/\{\{source\}\}/g, lead.leadSource || 'website');
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateEmailLimits(campaignId: string, leadCount: number): Promise<{
    valid: boolean;
    message?: string;
    dailyLimit?: number;
    dailySent?: number;
  }> {
    try {
      // Check daily email limits (implement your business logic here)
      const dailyLimit = 1000; // Example: 1000 emails per day per campaign
      
      // Get today's sent emails for this campaign
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return { valid: false, message: 'Campaign not found' };
      }

      const metrics = {}; // Note: performanceMetrics field doesn't exist in schema
      
      const dailySent = 0; // Note: metrics field doesn't exist in schema
      const remainingQuota = dailyLimit - dailySent;

      if (leadCount > remainingQuota) {
        return {
          valid: false,
          message: `Email limit exceeded. Daily limit: ${dailyLimit}, already sent: ${dailySent}, requested: ${leadCount}`,
          dailyLimit,
          dailySent
        };
      }

      return { valid: true, dailyLimit, dailySent };

    } catch (error) {
      console.error('Email limit validation error:', error);
      return { 
        valid: false, 
        message: 'Failed to validate email limits' 
      };
    }
  }
}

export const executionProcessor = new ExecutionProcessor();