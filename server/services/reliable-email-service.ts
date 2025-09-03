import { queueEmail, queueBulkEmails, type EmailJob } from './email-queue';
import { isEmailSuppressed } from './suppression-manager';
import { toError } from '../utils/error';
import logger from '../logging/logger';
import { sanitizeAutomotiveReply } from './reply-sanitizer';

export interface CampaignEmailData {
  to: string;
  from?: string;
  subject: string;
  content: string;
  campaignId?: string;
  leadId?: string;
  clientId?: string;
  priority?: number;
  scheduledFor?: Date;
  domainOverride?: string;
  isAutoResponse?: boolean;
  metadata?: Record<string, any>;
  threadingHeaders?: Record<string, string>;
}

export interface BulkEmailResult {
  success: boolean;
  queued: number;
  failed: number;
  suppressed: number;
  errors: string[];
}

/**
 * Send a single campaign email via the reliable queue system
 * Replaces direct mailgun.sendCampaignEmail calls
 */
export async function sendReliableCampaignEmail(
  emailData: CampaignEmailData
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.to)) {
      return { 
        success: false, 
        error: `Invalid email address: ${emailData.to}` 
      };
    }

    // Check suppression list
    const isSuppressed = await isEmailSuppressed(emailData.to, emailData.clientId);
    if (isSuppressed) {
      logger.warn(`Email ${emailData.to} is suppressed, not queuing`, {
        campaignId: emailData.campaignId,
        leadId: emailData.leadId,
      });
      
      return { 
        success: false, 
        error: `Email address ${emailData.to} is suppressed` 
      };
    }

    // Sanitize content to remove any leftover template placeholders (e.g., [dealership city])
    const sanitizedContent = sanitizeAutomotiveReply(emailData.content || '');

    // Prepare email job data
    const emailJob: EmailJob = {
      to: emailData.to,
      from: emailData.from || getDefaultFromAddress(emailData.domainOverride),
      subject: emailData.subject,
      html: sanitizedContent,
      text: stripHtml(sanitizedContent),
      campaignId: emailData.campaignId,
      leadId: emailData.leadId,
      clientId: emailData.clientId,
      priority: emailData.priority || 0,
      scheduledFor: emailData.scheduledFor,
      domainOverride: emailData.domainOverride,
      isAutoResponse: emailData.isAutoResponse,
      threadingHeaders: emailData.threadingHeaders,
      metadata: {
        ...emailData.metadata,
        source: 'campaign',
        timestamp: Date.now(),
      },
    };

    // Queue the email
    const queueId = await queueEmail(emailJob);

    logger.info('Campaign email queued successfully', {
      queueId,
      to: emailData.to,
      campaignId: emailData.campaignId,
      leadId: emailData.leadId,
      priority: emailData.priority,
    });

    return { success: true, queueId };
  } catch (error) {
    const normalizedError = toError(error);
    
    logger.error('Failed to send reliable campaign email', {
      to: emailData.to,
      campaignId: emailData.campaignId,
      leadId: emailData.leadId,
      error: normalizedError,
    });

    return { success: false, error: normalizedError.message };
  }
}

/**
 * Send bulk campaign emails via the reliable queue system
 * Replaces direct mailgun.sendBulkEmails calls
 */
export async function sendReliableBulkEmails(
  emails: CampaignEmailData[]
): Promise<BulkEmailResult> {
  const result: BulkEmailResult = {
    success: true,
    queued: 0,
    failed: 0,
    suppressed: 0,
    errors: [],
  };

  try {
    // Pre-filter suppressed emails to avoid unnecessary queue operations
    const validEmails: EmailJob[] = [];
    const suppressedEmails: string[] = [];

    for (const emailData of emails) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailData.to)) {
        result.failed++;
        result.errors.push(`Invalid email format: ${emailData.to}`);
        continue;
      }

      // Check suppression
      const isSuppressed = await isEmailSuppressed(emailData.to, emailData.clientId);
      if (isSuppressed) {
        suppressedEmails.push(emailData.to);
        result.suppressed++;
        continue;
      }

      // Prepare email job
      validEmails.push({
        to: emailData.to,
        from: emailData.from || getDefaultFromAddress(emailData.domainOverride),
        subject: emailData.subject,
        html: emailData.content,
        text: stripHtml(emailData.content),
        campaignId: emailData.campaignId,
        leadId: emailData.leadId,
        clientId: emailData.clientId,
        priority: emailData.priority || 0,
        scheduledFor: emailData.scheduledFor,
        domainOverride: emailData.domainOverride,
        isAutoResponse: emailData.isAutoResponse,
        threadingHeaders: emailData.threadingHeaders,
        metadata: {
          ...emailData.metadata,
          source: 'bulk_campaign',
          timestamp: Date.now(),
        },
      });
    }

    // Log suppressed emails
    if (suppressedEmails.length > 0) {
      logger.info(`Skipped ${suppressedEmails.length} suppressed emails in bulk send`, {
        suppressedCount: suppressedEmails.length,
        totalEmails: emails.length,
      });
    }

    // Queue all valid emails
    if (validEmails.length > 0) {
      const queueResult = await queueBulkEmails(validEmails);
      result.queued = queueResult.queued;
      result.failed += queueResult.failed;
      result.errors.push(...queueResult.errors);
    }

    result.success = result.failed === 0;

    logger.info('Bulk campaign emails processed', {
      total: emails.length,
      queued: result.queued,
      failed: result.failed,
      suppressed: result.suppressed,
      success: result.success,
    });

    return result;
  } catch (error) {
    const normalizedError = toError(error);
    
    logger.error('Failed to send reliable bulk emails', {
      totalEmails: emails.length,
      error: normalizedError,
    });

    result.success = false;
    result.errors.push(`Bulk processing failed: ${normalizedError.message}`);
    
    return result;
  }
}

/**
 * Schedule campaign emails for future delivery
 */
export async function scheduleReliableCampaignEmails(
  emails: CampaignEmailData[],
  scheduledFor: Date
): Promise<BulkEmailResult> {
  // Add scheduling to all emails
  const scheduledEmails = emails.map(email => ({
    ...email,
    scheduledFor,
    priority: (email.priority || 0) + 1, // Slightly higher priority for scheduled emails
    metadata: {
      ...email.metadata,
      scheduled: true,
      originalScheduleTime: scheduledFor.toISOString(),
    },
  }));

  logger.info('Scheduling campaign emails for future delivery', {
    count: emails.length,
    scheduledFor: scheduledFor.toISOString(),
  });

  return sendReliableBulkEmails(scheduledEmails);
}

/**
 * Send high-priority email (for urgent notifications, handovers, etc.)
 */
export async function sendHighPriorityEmail(
  emailData: CampaignEmailData
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  return sendReliableCampaignEmail({
    ...emailData,
    priority: 10, // Highest priority
    metadata: {
      ...emailData.metadata,
      urgent: true,
      priority: 'high',
    },
  });
}

/**
 * Send auto-response email via queue system
 */
export async function sendReliableAutoResponse(
  to: string,
  subject: string,
  content: string,
  variables: Record<string, any> = {},
  options: {
    domainOverride?: string;
    campaignId?: string;
    leadId?: string;
    clientId?: string;
  } = {}
): Promise<boolean> {
  const result = await sendReliableCampaignEmail({
    to,
    subject,
    content,
    campaignId: options.campaignId,
    leadId: options.leadId,
    clientId: options.clientId,
    domainOverride: options.domainOverride,
    isAutoResponse: true,
    priority: 5, // High priority for auto-responses
    metadata: {
      ...variables,
      autoResponse: true,
      responseType: 'automated',
    },
  });

  return result.success;
}

/**
 * Validate email addresses using the same logic as the queue system
 */
export async function validateReliableEmailAddresses(
  emails: string[],
  clientId?: string
): Promise<{
  valid: string[];
  invalid: string[];
  suppressed: string[];
}> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: string[] = [];
  const invalid: string[] = [];
  const suppressed: string[] = [];

  for (const email of emails) {
    const trimmedEmail = email.trim();
    
    if (!emailRegex.test(trimmedEmail)) {
      invalid.push(trimmedEmail);
      continue;
    }

    const isSuppressed = await isEmailSuppressed(trimmedEmail, clientId);
    if (isSuppressed) {
      suppressed.push(trimmedEmail);
      continue;
    }

    valid.push(trimmedEmail);
  }

  return { valid, invalid, suppressed };
}

/**
 * Get email delivery statistics for a campaign
 */
export async function getCampaignEmailStats(campaignId: string): Promise<{
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  complained: number;
  unsubscribed: number;
  pending: number;
  failed: number;
}> {
  try {
    // This would typically query the email_queue and email_delivery_events tables
    // For now, return a placeholder that can be implemented once the database queries are set up
    
    // TODO: Implement actual database queries once the migration is run
    return {
      sent: 0,
      delivered: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      complained: 0,
      unsubscribed: 0,
      pending: 0,
      failed: 0,
    };
  } catch (error) {
    logger.error('Failed to get campaign email stats', { campaignId, error });
    return {
      sent: 0,
      delivered: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      complained: 0,
      unsubscribed: 0,
      pending: 0,
      failed: 0,
    };
  }
}

// Helper functions

function getDefaultFromAddress(domainOverride?: string): string {
  const domain = (domainOverride || process.env.MAILGUN_DOMAIN || 'example.com').trim();
  const name = process.env.DEFAULT_SENDER_NAME || 'OneKeel Swarm';
  const local = process.env.MAILGUN_FROM_LOCAL_PART || 'campaigns';
  return `${name} <${local}@${domain}>`;
}

function stripHtml(html: string): string {
  if (!html) return '';
  
  // Simple HTML to text conversion
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000); // Reasonable limit for text version
}

// Backward compatibility exports for existing code
export { sendReliableCampaignEmail as sendCampaignEmail };
export { sendReliableBulkEmails as sendBulkEmails };
export { validateReliableEmailAddresses as validateEmailAddresses };
