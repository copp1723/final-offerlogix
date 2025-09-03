/**
 * V2 Webhook Handler
 * Processes Mailgun webhooks for V2 messages and updates status
 */

import { eq } from 'drizzle-orm';
import { dbV2, v2schema } from '../../db.js';
import logger from '../../../logging/logger.js';

export interface MailgunWebhookEvent {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    event: string;
    timestamp: number;
    message: {
      headers: {
        'message-id': string;
      };
    };
    recipient: string;
    'user-variables'?: {
      [key: string]: string;
    };
    severity?: string;
    reason?: string;
    'delivery-status'?: {
      description?: string;
    };
  };
}

export class V2WebhookHandler {
  /**
   * Process Mailgun webhook event for V2 messages
   */
  async processWebhookEvent(event: MailgunWebhookEvent): Promise<boolean> {
    try {
      const { 'event-data': eventData } = event;
      const messageId = eventData.message?.headers?.['message-id'];
      const eventType = eventData.event;
      const recipientEmail = eventData.recipient;

      if (!messageId) {
        logger.warn('V2 webhook: No message-id found in event', { eventType, recipientEmail });
        return false;
      }

      logger.info('Processing V2 webhook event', {
        eventType,
        messageId,
        recipientEmail,
        timestamp: eventData.timestamp
      });

      // Find the V2 message by message_id
      const message = await dbV2
        .select()
        .from(v2schema.messages)
        .where(eq(v2schema.messages.messageId, messageId))
        .limit(1);

      if (message.length === 0) {
        logger.warn('V2 webhook: Message not found', { messageId, eventType });
        return false;
      }

      const messageRecord = message[0];

      // Update message status based on event type
      const updates = await this.getStatusUpdates(eventType, messageId, eventData);
      
      if (Object.keys(updates).length > 0) {
        await dbV2
          .update(v2schema.messages)
          .set(updates)
          .where(eq(v2schema.messages.id, messageRecord.id));

        logger.info('V2 message status updated', {
          messageId: messageRecord.id,
          messageIdHeader: messageId,
          eventType,
          updates
        });
      }

      // Update conversation message count if needed
      if (eventType === 'delivered' && messageRecord.sender === 'agent') {
        await this.updateConversationStats(messageRecord.conversationId);
      }

      return true;
    } catch (error) {
      logger.error('V2 webhook processing failed', {
        error: error instanceof Error ? error.message : error,
        event: JSON.stringify(event, null, 2)
      });
      return false;
    }
  }

  /**
   * Get status updates based on webhook event type
   */
  private async getStatusUpdates(
    eventType: string, 
    messageId: string, 
    eventData: any
  ): Promise<Partial<typeof v2schema.messages.$inferInsert>> {
    const updates: Partial<typeof v2schema.messages.$inferInsert> = {};

    switch (eventType) {
      case 'delivered':
        updates.status = 'sent';
        updates.providerMessageId = messageId;
        break;

      case 'failed':
        updates.status = 'failed';
        updates.providerMessageId = messageId;
        break;

      case 'accepted':
      case 'queued':
        // Message accepted by Mailgun, still pending delivery
        updates.providerMessageId = messageId;
        // Keep status as 'pending' until delivered
        break;

      case 'opened':
      case 'clicked':
        // Positive engagement events - ensure status is 'sent'
        updates.status = 'sent';
        updates.providerMessageId = messageId;
        break;

      default:
        logger.debug('V2 webhook: Unhandled event type', { eventType, messageId });
        // Still update provider message ID for tracking
        updates.providerMessageId = messageId;
    }

    return updates;
  }

  /**
   * Update conversation statistics
   */
  private async updateConversationStats(conversationId: string): Promise<void> {
    try {
      // Get current message count
      const messageCount = await dbV2
        .select()
        .from(v2schema.messages)
        .where(eq(v2schema.messages.conversationId, conversationId));

      // Update conversation message count
      await dbV2
        .update(v2schema.conversations)
        .set({
          messageCount: messageCount.length,
          updatedAt: new Date()
        })
        .where(eq(v2schema.conversations.id, conversationId));

    } catch (error) {
      logger.error('Failed to update conversation stats', {
        conversationId,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Verify webhook signature (basic implementation)
   */
  verifyWebhookSignature(timestamp: string, token: string, signature: string): boolean {
    // For now, return true - implement proper signature verification if needed
    // This would use MAILGUN_SIGNING_KEY to verify the webhook is from Mailgun
    return true;
  }
}
