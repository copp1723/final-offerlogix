import { sendCampaignEmail } from './mailgun';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface NotificationTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface UserNotificationOptions {
  userId: string;
  type: NotificationType;
  data: Record<string, any>;
  urgency?: 'low' | 'medium' | 'high';
  sendEmail?: boolean;
  sendSMS?: boolean;
}

export enum NotificationType {
  CAMPAIGN_EXECUTED = 'campaign_executed',
  CAMPAIGN_COMPLETED = 'campaign_completed',
  LEAD_ASSIGNED = 'lead_assigned',
  HIGH_ENGAGEMENT = 'high_engagement',
  SYSTEM_ALERT = 'system_alert',
  MONTHLY_REPORT = 'monthly_report',
  EMAIL_VALIDATION_WARNING = 'email_validation_warning',
  QUOTA_WARNING = 'quota_warning'
}

// Email notification templates
const notificationTemplates: Record<NotificationType, (data: any) => NotificationTemplate> = {
  [NotificationType.CAMPAIGN_EXECUTED]: (data) => ({
    subject: `Campaign "${data.campaignName}" Successfully Executed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Campaign Execution Complete</h2>
        <p>Your automotive email campaign "<strong>${data.campaignName}</strong>" has been successfully executed.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Execution Summary:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Emails Sent:</strong> ${data.emailsSent || 0}</li>
            <li><strong>Leads Targeted:</strong> ${data.leadsTargeted || 0}</li>
            <li><strong>Template Used:</strong> ${data.templateTitle || 'N/A'}</li>
            <li><strong>Execution Time:</strong> ${new Date(data.executedAt || Date.now()).toLocaleString()}</li>
          </ul>
        </div>
        
        <p>You can monitor campaign performance and view detailed analytics in your dashboard.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/campaigns" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Campaign Results
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          OfferLogix - Automotive Email Marketing Platform
        </p>
      </div>
    `,
    text: `Campaign "${data.campaignName}" Successfully Executed

Your automotive email campaign has been completed.

Execution Summary:
- Emails Sent: ${data.emailsSent || 0}
- Leads Targeted: ${data.leadsTargeted || 0}
- Template Used: ${data.templateTitle || 'N/A'}
- Execution Time: ${new Date(data.executedAt || Date.now()).toLocaleString()}

View your campaign results at: ${process.env.SITE_URL || 'http://localhost:5050'}/campaigns`
  }),

  [NotificationType.CAMPAIGN_COMPLETED]: (data) => ({
    subject: `Campaign "${data.campaignName}" Sequence Completed`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Campaign Sequence Complete</h2>
        <p>Your automotive email campaign "<strong>${data.campaignName}</strong>" has completed its full sequence.</p>
        
        <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <h3 style="margin-top: 0; color: #059669;">Final Results:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Total Emails Sent:</strong> ${data.totalEmailsSent || 0}</li>
            <li><strong>Overall Open Rate:</strong> ${data.openRate || 0}%</li>
            <li><strong>Leads Engaged:</strong> ${data.leadsEngaged || 0}</li>
            <li><strong>Campaign Duration:</strong> ${data.duration || 'N/A'}</li>
          </ul>
        </div>
        
        <p>Congratulations on completing your automotive email campaign! Review the detailed analytics to optimize future campaigns.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/campaigns/${data.campaignId}/analytics" 
             style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Complete Analytics
          </a>
        </div>
      </div>
    `,
    text: `Campaign "${data.campaignName}" Sequence Completed

Your automotive email campaign has completed its full sequence.

Final Results:
- Total Emails Sent: ${data.totalEmailsSent || 0}
- Overall Open Rate: ${data.openRate || 0}%
- Leads Engaged: ${data.leadsEngaged || 0}
- Campaign Duration: ${data.duration || 'N/A'}`
  }),

  [NotificationType.LEAD_ASSIGNED]: (data) => ({
    subject: `New Lead Assigned: ${data.leadName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">New Lead Assignment</h2>
        <p>A new lead has been assigned to your campaign "<strong>${data.campaignName}</strong>".</p>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #dc2626;">Lead Details:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Name:</strong> ${data.leadName}</li>
            <li><strong>Email:</strong> ${data.leadEmail}</li>
            <li><strong>Phone:</strong> ${data.leadPhone || 'Not provided'}</li>
            <li><strong>Vehicle Interest:</strong> ${data.vehicleInterest || 'General inquiry'}</li>
            <li><strong>Lead Source:</strong> ${data.leadSource || 'Unknown'}</li>
          </ul>
        </div>
        
        <p>This lead will be included in your next campaign execution. Consider personalizing the approach based on their vehicle interest.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/leads" 
             style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Manage Leads
          </a>
        </div>
      </div>
    `,
    text: `New Lead Assignment

A new lead has been assigned to your campaign "${data.campaignName}".

Lead Details:
- Name: ${data.leadName}
- Email: ${data.leadEmail}
- Phone: ${data.leadPhone || 'Not provided'}
- Vehicle Interest: ${data.vehicleInterest || 'General inquiry'}
- Lead Source: ${data.leadSource || 'Unknown'}`
  }),

  [NotificationType.HIGH_ENGAGEMENT]: (data) => ({
    subject: `High Engagement Alert: ${data.campaignName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">High Engagement Detected! 🎯</h2>
        <p>Your campaign "<strong>${data.campaignName}</strong>" is performing exceptionally well.</p>
        
        <div style="background: #f5f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
          <h3 style="margin-top: 0; color: #7c3aed;">Performance Highlights:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Current Open Rate:</strong> ${data.openRate || 0}% (${data.benchmark || '25'}% above average)</li>
            <li><strong>Click-through Rate:</strong> ${data.clickRate || 0}%</li>
            <li><strong>Active Responses:</strong> ${data.responses || 0}</li>
            <li><strong>Engagement Score:</strong> ${data.engagementScore || 0}/100</li>
          </ul>
        </div>
        
        <p>Consider scaling this successful campaign or using its templates as a foundation for future campaigns.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/campaigns/${data.campaignId}" 
             style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Campaign Performance
          </a>
        </div>
      </div>
    `,
    text: `High Engagement Alert: ${data.campaignName}

Your campaign is performing exceptionally well!

Performance Highlights:
- Current Open Rate: ${data.openRate || 0}% (${data.benchmark || '25'}% above average)
- Click-through Rate: ${data.clickRate || 0}%
- Active Responses: ${data.responses || 0}
- Engagement Score: ${data.engagementScore || 0}/100`
  }),

  [NotificationType.SYSTEM_ALERT]: (data) => ({
    subject: `System Alert: ${data.alertTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">System Alert</h2>
        <p><strong>${data.alertTitle}</strong></p>
        
        <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
          <p style="margin: 0;">${data.message}</p>
          ${data.details ? `<p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">${data.details}</p>` : ''}
        </div>
        
        ${data.actionRequired ? `
        <p style="color: #dc2626;"><strong>Action Required:</strong> ${data.actionRequired}</p>
        ` : ''}
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/dashboard" 
             style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
      </div>
    `,
    text: `System Alert: ${data.alertTitle}

${data.message}

${data.details || ''}

${data.actionRequired ? `Action Required: ${data.actionRequired}` : ''}`
  }),

  [NotificationType.MONTHLY_REPORT]: (data) => ({
    subject: `Monthly Report - ${data.month} ${data.year}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Monthly Campaign Report</h2>
        <p>Here's your automotive email marketing summary for <strong>${data.month} ${data.year}</strong>.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Monthly Statistics:</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
              <p style="margin: 5px 0;"><strong>Campaigns Executed:</strong> ${data.campaignsExecuted || 0}</p>
              <p style="margin: 5px 0;"><strong>Total Emails Sent:</strong> ${data.totalEmailsSent || 0}</p>
              <p style="margin: 5px 0;"><strong>New Leads:</strong> ${data.newLeads || 0}</p>
            </div>
            <div>
              <p style="margin: 5px 0;"><strong>Average Open Rate:</strong> ${data.avgOpenRate || 0}%</p>
              <p style="margin: 5px 0;"><strong>Response Rate:</strong> ${data.responseRate || 0}%</p>
              <p style="margin: 5px 0;"><strong>Conversions:</strong> ${data.conversions || 0}</p>
            </div>
          </div>
        </div>
        
        <p>Keep up the great work with your automotive email marketing campaigns!</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/analytics" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Detailed Analytics
          </a>
        </div>
      </div>
    `,
    text: `Monthly Campaign Report - ${data.month} ${data.year}

Monthly Statistics:
- Campaigns Executed: ${data.campaignsExecuted || 0}
- Total Emails Sent: ${data.totalEmailsSent || 0}
- New Leads: ${data.newLeads || 0}
- Average Open Rate: ${data.avgOpenRate || 0}%
- Response Rate: ${data.responseRate || 0}%
- Conversions: ${data.conversions || 0}`
  }),

  [NotificationType.EMAIL_VALIDATION_WARNING]: (data) => ({
    subject: `Email Validation Warning: Action Required`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Email Validation Warning</h2>
        <p>We've detected potential issues with your email campaign that require attention.</p>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <h3 style="margin-top: 0; color: #dc2626;">Issues Detected:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${data.issues?.map((issue: string) => `<li>${issue}</li>`).join('') || '<li>Validation issues detected</li>'}
          </ul>
        </div>
        
        <p><strong>Campaign Affected:</strong> ${data.campaignName}</p>
        <p>Please review and fix these issues before your next campaign execution to ensure optimal deliverability.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/campaigns/${data.campaignId}" 
             style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Fix Campaign Issues
          </a>
        </div>
      </div>
    `,
    text: `Email Validation Warning: Action Required

We've detected potential issues with your email campaign.

Campaign Affected: ${data.campaignName}

Issues Detected:
${data.issues?.map((issue: string) => `- ${issue}`).join('\n') || '- Validation issues detected'}

Please review and fix these issues before your next campaign execution.`
  }),

  [NotificationType.QUOTA_WARNING]: (data) => ({
    subject: `Usage Quota Warning: ${data.percentage}% Used`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ea580c;">Usage Quota Warning</h2>
        <p>You've used <strong>${data.percentage}%</strong> of your monthly email quota.</p>
        
        <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
          <h3 style="margin-top: 0; color: #ea580c;">Current Usage:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li><strong>Emails Sent:</strong> ${data.emailsSent || 0} / ${data.emailsQuota || 0}</li>
            <li><strong>Remaining:</strong> ${(data.emailsQuota || 0) - (data.emailsSent || 0)} emails</li>
            <li><strong>Reset Date:</strong> ${data.resetDate || 'End of month'}</li>
          </ul>
        </div>
        
        <p>Consider upgrading your plan or optimizing your campaigns to stay within your quota.</p>
        
        <div style="margin: 30px 0;">
          <a href="${process.env.SITE_URL || 'http://localhost:5050'}/billing" 
             style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Manage Billing
          </a>
        </div>
      </div>
    `,
    text: `Usage Quota Warning: ${data.percentage}% Used

Current Usage:
- Emails Sent: ${data.emailsSent || 0} / ${data.emailsQuota || 0}
- Remaining: ${(data.emailsQuota || 0) - (data.emailsSent || 0)} emails
- Reset Date: ${data.resetDate || 'End of month'}

Consider upgrading your plan or optimizing your campaigns.`
  }),
};

export class UserNotificationService {
  
  /**
   * Send a notification to a user
   */
  async sendNotification(options: UserNotificationOptions): Promise<boolean> {
    try {
      const { userId, type, data, urgency = 'medium', sendEmail = true } = options;
      
      if (!sendEmail) {
        console.log(`Notification queued for user ${userId}: ${type}`, data);
        return true;
      }

      // Get user email
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.email) {
        console.error(`User ${userId} not found or has no email`);
        return false;
      }

      // Generate notification content
      const template = notificationTemplates[type];
      if (!template) {
        console.error(`No template found for notification type: ${type}`);
        return false;
      }

      const content = template(data);
      
      // Send email notification using campaign email service
      const { storage } = await import('../storage');
      const activeCfg = await storage.getActiveAiAgentConfig().catch(() => undefined);
      const success = await sendCampaignEmail(
        user.email,
        content.subject,
        content.html,
        content.text,
        'OfferLogix'
      );

      if (success) {
        console.log(`✅ Notification sent to ${user.email}: ${type}`);
      } else {
        console.error(`❌ Failed to send notification to ${user.email}: ${type}`);
      }

      return success;
    } catch (error) {
      console.error('Error sending user notification:', error);
      return false;
    }
  }

  /**
   * Send campaign execution notification
   */
  async notifyCampaignExecuted(userId: string, campaignData: {
    campaignName: string;
    campaignId: string;
    emailsSent: number;
    leadsTargeted: number;
    templateTitle: string;
    executedAt: Date;
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.CAMPAIGN_EXECUTED,
      data: campaignData,
      urgency: 'medium'
    });
  }

  /**
   * Send campaign completion notification  
   */
  async notifyCampaignCompleted(userId: string, campaignData: {
    campaignName: string;
    campaignId: string;
    totalEmailsSent: number;
    openRate: number;
    leadsEngaged: number;
    duration: string;
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.CAMPAIGN_COMPLETED,
      data: campaignData,
      urgency: 'low'
    });
  }

  /**
   * Send new lead assignment notification
   */
  async notifyLeadAssigned(userId: string, leadData: {
    leadName: string;
    leadEmail: string;
    leadPhone?: string;
    vehicleInterest?: string;
    leadSource?: string;
    campaignName: string;
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.LEAD_ASSIGNED,
      data: leadData,
      urgency: 'high'
    });
  }

  /**
   * Send high engagement alert
   */
  async notifyHighEngagement(userId: string, engagementData: {
    campaignName: string;
    campaignId: string;
    openRate: number;
    clickRate: number;
    responses: number;
    engagementScore: number;
    benchmark: number;
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.HIGH_ENGAGEMENT,
      data: engagementData,
      urgency: 'medium'
    });
  }

  /**
   * Send system alert
   */
  async sendSystemAlert(userId: string, alertData: {
    alertTitle: string;
    message: string;
    details?: string;
    actionRequired?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      data: alertData,
      urgency: 'high'
    });
  }

  /**
   * Send monthly report
   */
  async sendMonthlyReport(userId: string, reportData: {
    month: string;
    year: number;
    campaignsExecuted: number;
    totalEmailsSent: number;
    newLeads: number;
    avgOpenRate: number;
    responseRate: number;
    conversions: number;
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.MONTHLY_REPORT,
      data: reportData,
      urgency: 'low'
    });
  }

  /**
   * Send email validation warning
   */
  async sendValidationWarning(userId: string, validationData: {
    campaignName: string;
    campaignId: string;
    issues: string[];
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.EMAIL_VALIDATION_WARNING,
      data: validationData,
      urgency: 'high'
    });
  }

  /**
   * Send quota warning
   */
  async sendQuotaWarning(userId: string, quotaData: {
    percentage: number;
    emailsSent: number;
    emailsQuota: number;
    resetDate: string;
  }): Promise<boolean> {
    return this.sendNotification({
      userId,
      type: NotificationType.QUOTA_WARNING,
      data: quotaData,
      urgency: 'medium'
    });
  }
}

// Export singleton instance
export const userNotificationService = new UserNotificationService();