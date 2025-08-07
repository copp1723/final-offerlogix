import { webSocketService } from '../websocket';

interface ExecutionBatch {
  batchId: string;
  leads: any[];
  template: any;
  scheduledAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface BatchResult {
  success: boolean;
  batchId: string;
  sentCount: number;
  errors: string[];
  processedLeads: any[];
}

interface EmailData {
  to: string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  tags?: string[];
}

export class ExecutionProcessor {
  private processingBatches = new Set<string>();

  async processBatch(
    batch: ExecutionBatch,
    campaign: any,
    testMode: boolean = false
  ): Promise<BatchResult> {
    console.log(`Processing batch: ${batch.batchId} (${batch.leads.length} leads)`);

    if (this.processingBatches.has(batch.batchId)) {
      throw new Error(`Batch ${batch.batchId} is already being processed`);
    }

    this.processingBatches.add(batch.batchId);

    const result: BatchResult = {
      success: true,
      batchId: batch.batchId,
      sentCount: 0,
      errors: [],
      processedLeads: []
    };

    try {
      batch.status = 'processing';

      // Process each lead in the batch
      for (const lead of batch.leads) {
        try {
          const emailData = this.prepareEmailData(lead, batch.template, campaign, testMode);
          
          if (testMode) {
            // In test mode, just log the email instead of sending
            console.log(`[TEST MODE] Would send email to ${lead.email}: ${emailData.subject}`);
            result.sentCount++;
          } else {
            // Send actual email
            const sent = await this.sendEmail(emailData, lead, campaign);
            if (sent) {
              result.sentCount++;
            } else {
              result.errors.push(`Failed to send email to ${lead.email}`);
            }
          }

          result.processedLeads.push(lead);

          // Update lead status
          await this.updateLeadProgress(lead, batch, campaign, testMode);

          // Add small delay between emails to avoid rate limiting
          if (!testMode) {
            await this.delay(1000); // 1 second delay
          }

        } catch (error) {
          const errorMsg = `Error processing lead ${lead.email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      batch.status = result.errors.length === 0 ? 'completed' : 'failed';
      result.success = result.errors.length === 0;

      console.log(`Batch ${batch.batchId} completed: ${result.sentCount}/${batch.leads.length} sent`);

    } catch (error) {
      console.error(`Batch processing failed: ${batch.batchId}`, error);
      batch.status = 'failed';
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Batch processing failed');
    } finally {
      this.processingBatches.delete(batch.batchId);
    }

    return result;
  }

  private prepareEmailData(
    lead: any,
    template: any,
    campaign: any,
    testMode: boolean
  ): EmailData {
    // Template personalization
    const personalizedSubject = this.personalizeContent(
      template.subject || campaign.name,
      lead,
      campaign
    );

    const personalizedContent = this.personalizeContent(
      template.content || template.body || 'Campaign email content',
      lead,
      campaign
    );

    // Add test mode prefix
    const subject = testMode 
      ? `[TEST] ${personalizedSubject}` 
      : personalizedSubject;

    return {
      to: [lead.email],
      subject,
      htmlContent: this.generateHtmlContent(personalizedContent, lead, campaign),
      textContent: this.stripHtml(personalizedContent),
      fromName: campaign.fromName || 'AutoCampaigns AI',
      fromEmail: campaign.fromEmail || process.env.SENDER_EMAIL || 'noreply@autocampaigns.ai',
      replyTo: campaign.replyTo || process.env.REPLY_TO_EMAIL,
      tags: [
        campaign.id,
        testMode ? 'test' : 'production',
        'campaign-execution'
      ]
    };
  }

  private personalizeContent(content: string, lead: any, campaign: any): string {
    let personalized = content;

    // Lead personalization
    const personalizations = {
      '{{firstName}}': lead.firstName || '',
      '{{lastName}}': lead.lastName || '',
      '{{fullName}}': [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Customer',
      '{{email}}': lead.email || '',
      '{{phone}}': lead.phone || '',
      '{{vehicleInterest}}': lead.vehicleInterest || 'our vehicles',
      '{{leadSource}}': lead.leadSource || 'inquiry',
      
      // Campaign personalization
      '{{campaignName}}': campaign.name || '',
      '{{dealershipName}}': campaign.dealershipName || 'Our Dealership',
      
      // Dynamic content
      '{{currentDate}}': new Date().toLocaleDateString(),
      '{{currentYear}}': new Date().getFullYear().toString(),
    };

    for (const [placeholder, value] of Object.entries(personalizations)) {
      personalized = personalized.replace(new RegExp(placeholder, 'g'), value);
    }

    return personalized;
  }

  private generateHtmlContent(content: string, lead: any, campaign: any): string {
    // Convert plain text to HTML if needed
    let htmlContent = content.includes('<html>') || content.includes('<body>') 
      ? content 
      : `<div>${content.replace(/\n/g, '<br>')}</div>`;

    // Add basic email structure if not present
    if (!htmlContent.includes('<html>')) {
      htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${campaign.name || 'AutoCampaigns Email'}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        .cta-button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>${campaign.name || 'AutoCampaigns AI'}</h2>
        </div>
        <div class="content">
            ${htmlContent}
        </div>
        <div class="footer">
            <p>This email was sent as part of the "${campaign.name}" campaign.</p>
            <p>You're receiving this because you expressed interest in our vehicles.</p>
            <p>If you wish to unsubscribe, please reply with "UNSUBSCRIBE".</p>
        </div>
    </div>
</body>
</html>`;
    }

    return htmlContent;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private async sendEmail(emailData: EmailData, lead: any, campaign: any): Promise<boolean> {
    try {
      // Check if Mailgun service is available
      if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
        return await this.sendViaMailgun(emailData);
      } else {
        // Fallback: Log email details for development
        console.log(`[EMAIL LOG] To: ${emailData.to[0]}, Subject: ${emailData.subject}`);
        return true;
      }
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  private async sendViaMailgun(emailData: EmailData): Promise<boolean> {
    try {
      // Import Mailgun service dynamically to avoid dependency issues
      const { sendCampaignEmail } = await import('../email/mailgun-service');
      
      const result = await sendCampaignEmail({
        to: emailData.to,
        subject: emailData.subject,
        htmlContent: emailData.htmlContent,
        textContent: emailData.textContent,
        fromName: emailData.fromName,
        fromEmail: emailData.fromEmail,
        replyTo: emailData.replyTo,
        tags: emailData.tags
      });

      return result.success;
    } catch (error) {
      console.error('Mailgun sending failed:', error);
      return false;
    }
  }

  private async updateLeadProgress(lead: any, batch: ExecutionBatch, campaign: any, testMode: boolean) {
    try {
      // Import storage dynamically to avoid circular dependency
      const { storage } = await import('../../storage');
      
      const updateData: any = {
        status: testMode ? 'test_contacted' : 'contacted',
        lastContactedAt: new Date(),
        notes: lead.notes 
          ? `${lead.notes}\n\n[${new Date().toISOString()}] Campaign email sent: ${campaign.name}`
          : `Campaign email sent: ${campaign.name}`
      };

      await storage.updateLead(lead.id, updateData);

      // Broadcast lead update
      webSocketService.broadcast({
        type: 'lead_updated',
        leadId: lead.id,
        lead: { ...lead, ...updateData }
      });

    } catch (error) {
      console.error('Error updating lead progress:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for monitoring
  getActiveBatches(): string[] {
    return Array.from(this.processingBatches);
  }

  isProcessingBatch(batchId: string): boolean {
    return this.processingBatches.has(batchId);
  }
}

export const executionProcessor = new ExecutionProcessor();