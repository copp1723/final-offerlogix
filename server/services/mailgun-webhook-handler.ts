import crypto from 'crypto';
import { eq, and, count, sum, sql } from 'drizzle-orm';
import { db } from '../db';
import { emailDeliveryEvents, emailQueue, campaignDeliveryMetrics, campaigns, type InsertEmailDeliveryEvent } from '../../shared/schema';
import { processBounce, processComplaint, processUnsubscribe } from './suppression-manager';
import { storage } from '../storage';
import { toError, createErrorContext } from '../utils/error';
import logger from '../logging/logger';

const processedWebhooks = new Map<string, number>();
const WEBHOOK_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupWebhookStore(): void {
  const cutoff = Date.now() - WEBHOOK_TTL_MS;
  for (const [key, ts] of processedWebhooks.entries()) {
    if (ts < cutoff) processedWebhooks.delete(key);
  }
}

export function isDuplicateWebhook(timestamp: string, token: string): boolean {
  cleanupWebhookStore();
  const key = `${timestamp}:${token}`;
  if (processedWebhooks.has(key)) return true;
  processedWebhooks.set(key, Date.now());
  return false;
}

export function clearWebhookDedupStore(): void {
  processedWebhooks.clear();
}

export interface MailgunWebhookEvent {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    event: string;
    timestamp: number;
    id: string;
    'log-level': 'info' | 'warn' | 'error';
    severity: 'temporary' | 'permanent';
    reason?: string;
    message?: {
      headers: {
        'message-id': string;
        to: string;
        from: string;
        subject: string;
      };
    };
    recipient: string;
    'recipient-domain': string;
    'delivery-status'?: {
      'attempt-no': number;
      message: string;
      code: number;
      description: string;
      'session-seconds': number;
    };
    flags?: {
      'is-routed': boolean;
      'is-authenticated': boolean;
      'is-system-test': boolean;
      'is-test-mode': boolean;
    };
    envelope?: {
      transport: string;
      sender: string;
      'sending-ip': string;
      targets: string;
    };
    campaigns?: Array<{
      id: string;
      name: string;
    }>;
    tags?: string[];
    'user-variables'?: Record<string, any>;
    'client-info'?: {
      'client-os': string;
      'client-name': string;
      'client-type': string;
      'device-type': string;
      'user-agent': string;
    };
    geolocation?: {
      city: string;
      region: string;
      country: string;
    };
    ip?: string;
    url?: string;
  };
}

/**
 * Verify Mailgun webhook signature
 */
export function verifyWebhookSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  try {
    const webhookSigningKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    if (!webhookSigningKey) {
      logger.error('MAILGUN_WEBHOOK_SIGNING_KEY not configured');
      return false;
    }

    // Verify timestamp is recent (within 15 minutes)
    const timestampNumber = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNumber) > 15 * 60) {
      logger.warn('Webhook timestamp too old', { timestamp, now });
      return false;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSigningKey)
      .update(`${timestamp}${token}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) {
      logger.warn('Invalid webhook signature', { 
        expected: expectedSignature,
        received: signature 
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying webhook signature', { error: toError(error) });
    return false;
  }
}

/**
 * Process Mailgun webhook event
 */
export async function processWebhookEvent(event: MailgunWebhookEvent): Promise<boolean> {
  try {
    const { signature, 'event-data': eventData } = event;

    // Verify webhook signature
    if (!verifyWebhookSignature(signature.timestamp, signature.token, signature.signature)) {
      logger.warn('Webhook signature verification failed');
      return false;
    }

    if (isDuplicateWebhook(signature.timestamp, signature.token)) {
      logger.warn('Duplicate webhook event received');
      return false;
    }

    // Extract relevant data
    const messageId = eventData.message?.headers['message-id'] || eventData.id;
    const recipientEmail = eventData.recipient;
    const eventType = eventData.event;
    const timestamp = new Date(eventData.timestamp * 1000);

    // Find related email queue record
    const emailQueueRecord = await findEmailQueueRecord(recipientEmail, messageId);
    
    // Extract campaign and lead IDs from user variables or email record
    const campaignId = eventData['user-variables']?.campaignId || emailQueueRecord?.campaignId;
    const leadId = eventData['user-variables']?.leadId || emailQueueRecord?.leadId;
    const clientId = eventData['user-variables']?.clientId || emailQueueRecord?.clientId;

    // Store delivery event
    await storeDeliveryEvent({
      emailQueueId: emailQueueRecord?.id,
      messageId,
      eventType,
      timestamp,
      recipientEmail,
      campaignId,
      leadId,
      userAgent: eventData['client-info']?.['user-agent'],
      clientName: eventData['client-info']?.['client-name'],
      clientOs: eventData['client-info']?.['client-os'],
      deviceType: eventData['client-info']?.['device-type'],
      url: eventData.url,
      ip: eventData.ip,
      city: eventData.geolocation?.city,
      region: eventData.geolocation?.region,
      country: eventData.geolocation?.country,
      metadata: {
        severity: eventData.severity,
        reason: eventData.reason,
        deliveryStatus: eventData['delivery-status'],
        flags: eventData.flags,
        envelope: eventData.envelope,
        campaigns: eventData.campaigns,
        tags: eventData.tags,
        userVariables: eventData['user-variables'],
      },
      clientId,
    });

    // Process event-specific logic
    await processEventSpecificLogic(eventData, campaignId, leadId, clientId);

    // If this event contains our user-variables with a conversation message id,
    // backfill the providerMessageId onto that message for robust threading.
    try {
      const uv = eventData['user-variables'] || {};
      const aiMessageId = uv.aiMessageId || uv.conversationMessageId;
      if (aiMessageId && messageId) {
        await storage.setConversationMessageProviderId(String(aiMessageId), String(messageId));
      }
    } catch (e) {
      logger.warn('Failed to set providerMessageId from webhook user-variables', { error: toError(e) });
    }

    // Update email queue record if found
    if (emailQueueRecord) {
      await updateEmailQueueStatus(emailQueueRecord.id, eventType);
    }

    // Update campaign metrics
    if (campaignId) {
      await updateCampaignMetrics(campaignId, eventType, clientId);
    }

    logger.info('Processed webhook event', {
      eventType,
      messageId,
      recipientEmail,
      campaignId,
      leadId,
    });

    return true;
  } catch (error) {
    logger.error('Failed to process webhook event', {
      error: toError(error),
      event: JSON.stringify(event, null, 2),
    });
    return false;
  }
}

/**
 * Find email queue record by recipient and message ID
 */
async function findEmailQueueRecord(recipientEmail: string, messageId: string) {
  try {
    // Try to find by recipient first (most reliable)
    const [record] = await db.select()
      .from(emailQueue)
      .where(eq(emailQueue.to, recipientEmail))
      .orderBy(emailQueue.createdAt)
      .limit(1);

    return record || null;
  } catch (error) {
    logger.error('Failed to find email queue record', {
      recipientEmail,
      messageId,
      error: toError(error)
    });
    return null;
  }
}

/**
 * Store delivery event in database
 */
async function storeDeliveryEvent(eventData: InsertEmailDeliveryEvent): Promise<void> {
  try {
    await db.insert(emailDeliveryEvents).values(eventData);
  } catch (error) {
    logger.error('Failed to store delivery event', { eventData, error: toError(error) });
  }
}

/**
 * Process event-specific logic (bounces, complaints, unsubscribes)
 */
async function processEventSpecificLogic(
  eventData: MailgunWebhookEvent['event-data'],
  campaignId?: string,
  leadId?: string,
  clientId?: string
): Promise<void> {
  try {
    const recipientEmail = eventData.recipient;

    switch (eventData.event) {
      case 'failed': {
        const bounceType = eventData.severity === 'permanent' ? 'hard' : 'soft';
        await processBounce({
          email: recipientEmail,
          bounceType,
          reason: eventData.reason || eventData['delivery-status']?.description || 'Email bounced',
          campaignId,
          leadId,
          clientId,
        });
        break;
      }

      case 'complained': {
        await processComplaint({
          email: recipientEmail,
          reason: eventData.reason || 'Spam complaint',
          campaignId,
          leadId,
          clientId,
        });

        // Optionally halt campaign on complaint
        await haltCampaignOnComplaint(campaignId);
        break;
      }

      case 'unsubscribed': {
        await processUnsubscribe({
          email: recipientEmail,
          reason: 'User unsubscribed',
          campaignId,
          leadId,
          clientId,
        });
        break;
      }

      case 'delivered':
      case 'opened':
      case 'clicked':
        // These are positive events, no suppression needed
        logger.debug(`Positive email event: ${eventData.event}`, {
          recipient: recipientEmail,
          campaignId,
        });

        // Update conversation state based on email engagement
        if (leadId && campaignId) {
          await updateConversationStateFromEmailEvent(eventData.event, leadId, campaignId, {
            messageId: eventData.message?.headers?.['message-id'],
            timestamp: new Date(eventData.timestamp * 1000),
            recipientEmail,
            userAgent: eventData['client-info']?.['user-agent'],
            url: eventData.url,
            ip: eventData.ip,
            geolocation: eventData.geolocation,
          });
        }
        break;

      default:
        logger.debug(`Unhandled email event: ${eventData.event}`, {
          recipient: recipientEmail,
          campaignId,
        });
    }
  } catch (error) {
    logger.error('Failed to process event-specific logic', {
      event: eventData.event,
      recipient: eventData.recipient,
      error: toError(error)
    });
  }
}

/**
 * Halt campaign execution when complaint received if configured
 */
async function haltCampaignOnComplaint(campaignId?: string): Promise<void> {
  if (!campaignId) return;
  try {
    const [campaign] = await db
      .select({ stopOnComplaint: campaigns.stopOnComplaint })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (campaign?.stopOnComplaint) {
      await db
        .update(campaigns)
        .set({ isActive: false, status: 'paused', updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));

      logger.warn('Campaign halted due to complaint', { campaignId });
    }
  } catch (error) {
    logger.error('Failed to halt campaign on complaint', { campaignId, error: toError(error) });
  }
}

/**
 * Update email queue status based on delivery event
 */
async function updateEmailQueueStatus(queueId: string, eventType: string): Promise<void> {
  try {
    let status = 'sent';

    switch (eventType) {
      case 'failed':
        status = 'failed';
        break;
      case 'delivered':
      case 'opened':
      case 'clicked':
        status = 'sent';
        break;
    }

    await db.update(emailQueue)
      .set({ 
        status,
        updatedAt: new Date(),
      })
      .where(eq(emailQueue.id, queueId));
  } catch (error) {
    logger.error('Failed to update email queue status', {
      queueId,
      eventType,
      error: toError(error)
    });
  }
}

/**
 * Update campaign delivery metrics
 */
async function updateCampaignMetrics(
  campaignId: string,
  eventType: string,
  clientId?: string
): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create metrics record for today
    const [existingMetrics] = await db.select()
      .from(campaignDeliveryMetrics)
      .where(
        eq(campaignDeliveryMetrics.campaignId, campaignId) &&
        eq(campaignDeliveryMetrics.date, today)
      )
      .limit(1);

    const updates: Partial<typeof campaignDeliveryMetrics.$inferInsert> = {};

    switch (eventType) {
      case 'delivered':
        updates.emailsDelivered = (existingMetrics?.emailsDelivered || 0) + 1;
        break;
      case 'failed':
        updates.emailsBounced = (existingMetrics?.emailsBounced || 0) + 1;
        break;
      case 'opened':
        updates.emailsOpened = (existingMetrics?.emailsOpened || 0) + 1;
        break;
      case 'clicked':
        updates.emailsClicked = (existingMetrics?.emailsClicked || 0) + 1;
        break;
      case 'complained':
        updates.emailsComplained = (existingMetrics?.emailsComplained || 0) + 1;
        break;
      case 'unsubscribed':
        updates.emailsUnsubscribed = (existingMetrics?.emailsUnsubscribed || 0) + 1;
        break;
    }

    if (Object.keys(updates).length === 0) {
      return; // No metrics to update
    }

    if (existingMetrics) {
      // Update existing record
      await db.update(campaignDeliveryMetrics)
        .set(updates)
        .where(eq(campaignDeliveryMetrics.id, existingMetrics.id));
    } else {
      // Create new record
      await db.insert(campaignDeliveryMetrics).values({
        campaignId,
        date: today,
        clientId,
        emailsSent: 0,
        emailsDelivered: 0,
        emailsBounced: 0,
        emailsOpened: 0,
        emailsClicked: 0,
        emailsUnsubscribed: 0,
        emailsComplained: 0,
        ...updates,
      });
    }

    // Calculate and update rates
    await calculateAndUpdateRates(campaignId, today);
  } catch (error) {
    logger.error('Failed to update campaign metrics', {
      campaignId,
      eventType,
      error: toError(error)
    });
  }
}

/**
 * Calculate and update delivery rates
 */
async function calculateAndUpdateRates(campaignId: string, date: Date): Promise<void> {
  try {
    const [metrics] = await db.select()
      .from(campaignDeliveryMetrics)
      .where(
        eq(campaignDeliveryMetrics.campaignId, campaignId) &&
        eq(campaignDeliveryMetrics.date, date)
      )
      .limit(1);

    if (!metrics) return;

    const sent = metrics.emailsSent || 0;
    const delivered = metrics.emailsDelivered || 0;
    const bounced = metrics.emailsBounced || 0;
    const opened = metrics.emailsOpened || 0;
    const clicked = metrics.emailsClicked || 0;
    const unsubscribed = metrics.emailsUnsubscribed || 0;
    const complained = metrics.emailsComplained || 0;

    const rates = {
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      clickRate: delivered > 0 ? Math.round((clicked / delivered) * 100) : 0,
      unsubscribeRate: delivered > 0 ? Math.round((unsubscribed / delivered) * 100) : 0,
      complaintRate: delivered > 0 ? Math.round((complained / delivered) * 100) : 0,
    };

    await db.update(campaignDeliveryMetrics)
      .set(rates)
      .where(eq(campaignDeliveryMetrics.id, metrics.id));
  } catch (error) {
    logger.error('Failed to calculate and update rates', {
      campaignId,
      date,
      error: toError(error)
    });
  }
}

/**
 * Get delivery events for a campaign
 */
export async function getCampaignDeliveryEvents(
  campaignId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    return await db.select()
      .from(emailDeliveryEvents)
      .where(eq(emailDeliveryEvents.campaignId, campaignId))
      .orderBy(emailDeliveryEvents.timestamp)
      .limit(limit);
  } catch (error) {
    logger.error('Failed to get campaign delivery events', {
      campaignId,
      error: toError(error)
    });
    return [];
  }
}

/**
 * Get delivery events for a specific email
 */
export async function getEmailDeliveryEvents(
  recipientEmail: string,
  limit: number = 50
): Promise<any[]> {
  try {
    return await db.select()
      .from(emailDeliveryEvents)
      .where(eq(emailDeliveryEvents.recipientEmail, recipientEmail))
      .orderBy(emailDeliveryEvents.timestamp)
      .limit(limit);
  } catch (error) {
    logger.error('Failed to get email delivery events', {
      recipientEmail,
      error: toError(error)
    });
    return [];
  }
}

export interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  deliveryRate: number; // delivered / sent * 100
  openRate: number; // opened / delivered * 100
  clickRate: number; // clicked / opened * 100
  bounceRate: number; // bounced / sent * 100
}

/**
 * Get aggregate delivery metrics for a campaign
 */
export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  try {
    const [sentResult] = await db
      .select({ count: count() })
      .from(emailQueue)
      .where(and(eq(emailQueue.campaignId, campaignId), eq(emailQueue.status, 'sent')));

    const [eventCounts] = await db
      .select({
        delivered: sum(sql`CASE WHEN ${emailDeliveryEvents.eventType} = 'delivered' THEN 1 ELSE 0 END`),
        opened: sum(sql`CASE WHEN ${emailDeliveryEvents.eventType} = 'opened' THEN 1 ELSE 0 END`),
        clicked: sum(sql`CASE WHEN ${emailDeliveryEvents.eventType} = 'clicked' THEN 1 ELSE 0 END`),
        bounced: sum(sql`CASE WHEN ${emailDeliveryEvents.eventType} = 'failed' THEN 1 ELSE 0 END`),
      })
      .from(emailDeliveryEvents)
      .where(eq(emailDeliveryEvents.campaignId, campaignId));

    const sent = Number(sentResult?.count ?? 0);
    const delivered = Number(eventCounts?.delivered ?? 0);
    const opened = Number(eventCounts?.opened ?? 0);
    const clicked = Number(eventCounts?.clicked ?? 0);
    const bounced = Number(eventCounts?.bounced ?? 0);

    // Calculate rates with safe division
    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;
    const openRate = delivered > 0 ? (opened / delivered) * 100 : 0;
    const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
    const bounceRate = sent > 0 ? (bounced / sent) * 100 : 0;

    return {
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      deliveryRate: Math.round(deliveryRate * 100) / 100, // Round to 2 decimal places
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
    };
  } catch (error) {
    logger.error('Failed to get campaign metrics', { campaignId, error: toError(error) });
    return { 
      sent: 0, 
      delivered: 0, 
      opened: 0, 
      clicked: 0, 
      bounced: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0
    };
  }
}

/**
 * Update conversation state based on email delivery events
 * Integrates email reliability system with conversation state management
 */
async function updateConversationStateFromEmailEvent(
  eventType: string,
  leadId: string,
  campaignId: string,
  eventMetadata: {
    messageId?: string;
    timestamp: Date;
    recipientEmail: string;
    userAgent?: string;
    url?: string;
    ip?: string;
    geolocation?: any;
  }
): Promise<void> {
  try {
    // Import conversation state manager dynamically to avoid circular dependencies
    const { conversationIntegrationManager } = await import('./conversation-state/ConversationIntegrationManager.js');
    
    // Find conversation for this lead and campaign
    const { storage } = await import('../storage.js');
    const conversations = await storage.getConversationsByLead(leadId);
    const conversation = conversations.find(c => c.campaignId === campaignId && c.status !== 'closed');
    
    if (!conversation) {
      logger.warn('No active conversation found for lead', { leadId, campaignId, eventType });
      return;
    }

    // Create integration event based on email event type
    let integrationEventType: 'email_delivered' | 'email_opened' | 'email_clicked' | 'email_bounced';
    
    switch (eventType) {
      case 'delivered':
        integrationEventType = 'email_delivered';
        break;
      case 'opened':
        integrationEventType = 'email_opened';
        break;
      case 'clicked':
        integrationEventType = 'email_clicked';
        break;
      case 'failed':
        integrationEventType = 'email_bounced';
        break;
      default:
        logger.debug(`Unhandled event type for conversation state: ${eventType}`);
        return;
    }

    // Create integration event
    const integrationEvent = {
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: integrationEventType,
      conversationId: conversation.id,
      leadId,
      metadata: {
        messageId: eventMetadata.messageId,
        recipientEmail: eventMetadata.recipientEmail,
        userAgent: eventMetadata.userAgent,
        url: eventMetadata.url,
        ip: eventMetadata.ip,
        geolocation: eventMetadata.geolocation,
        campaignId,
      },
      timestamp: eventMetadata.timestamp,
      source: 'email_service',
    };

    // Process the integration event to update conversation state
    await conversationIntegrationManager.processIntegrationEvent(integrationEvent);

    logger.info('Updated conversation state from email event', {
      eventType: integrationEventType,
      conversationId: conversation.id,
      leadId,
      campaignId,
    });

  } catch (error) {
    logger.error('Failed to update conversation state from email event', {
      eventType,
      leadId,
      error: toError(error),
      campaignId,
    });
  }
}
