import { Request, Response } from 'express';
import { storage } from '../storage';
import { liveConversationService } from './live-conversation';
import { InboundEmailService } from './inbound-email';
import { SuppressionManager } from './deliverability/SuppressionManager';

export class WebhookHandler {
  /**
   * Handle Mailgun webhook for inbound emails
   * Endpoint: POST /api/webhooks/mailgun/inbound
   */
  static async handleMailgunInbound(req: Request, res: Response) {
    try {
      await InboundEmailService.handleInboundEmail(req, res);
      
      // Store Mailgun events in Supermemory for AI recall
      try {
        const event = req.body;
        const { MemoryMapper } = await import('../integrations/supermemory');
        await MemoryMapper.writeWebhook({
          type: 'webhook',
          clientId: 'default', // TODO: resolve from recipient->lead->clientId
          source: 'mailgun',
          content: `Mailgun ${event.event || 'unknown'} event for ${event.recipient}\nMessage ID: ${event['message-id']}\nTimestamp: ${event.timestamp || new Date().toISOString()}`,
          meta: {
            event: event.event || 'unknown',
            messageId: event['message-id'],
            recipient: event.recipient,
            timestamp: event.timestamp || new Date().toISOString(),
            eventData: event
          }
        });
      } catch (error) {
        console.warn('Failed to store Mailgun event in Supermemory:', error);
      }
    } catch (error) {
      console.error('Mailgun webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle Mailgun delivery status webhooks
   * Endpoint: POST /api/webhooks/mailgun/events
   */
  static async handleMailgunEvents(req: Request, res: Response) {
    try {
      const event = req.body;
      
      if (!event.event || !event['message-id']) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      // Process suppression events first
      await SuppressionManager.processWebhookEvent(event);

      // Process different event types
      switch (event.event) {
        case 'delivered':
          await this.handleEmailDelivered(event);
          break;
        case 'opened':
          await this.handleEmailOpened(event);
          break;
        case 'clicked':
          await this.handleEmailClicked(event);
          break;
        case 'bounced':
        case 'failed':
          await this.handleEmailFailed(event);
          break;
        case 'unsubscribed':
          await this.handleEmailUnsubscribed(event);
          break;
        default:
          console.log('Unhandled Mailgun event:', event.event);
      }

      res.status(200).json({ message: 'Event processed' });
    } catch (error) {
      console.error('Mailgun event processing error:', error);
      res.status(500).json({ error: 'Event processing failed' });
    }
  }

  /**
   * Handle Twilio SMS webhook for inbound messages
   * Endpoint: POST /api/webhooks/twilio/sms
   */
  static async handleTwilioSMS(req: Request, res: Response) {
    try {
      await InboundEmailService.handleInboundSMS(req, res);
    } catch (error) {
      console.error('Twilio SMS webhook error:', error);
      res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Response><Message>Error processing message</Message></Response>');
    }
  }

  /**
   * Handle campaign execution webhooks (for scheduled campaigns)
   * Endpoint: POST /api/webhooks/campaign/execute
   */
  static async handleCampaignExecution(req: Request, res: Response) {
    try {
      const { campaignId, leadId, templateId, scheduledTime } = req.body;

      if (!campaignId || !leadId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Get lead and campaign info
      const lead = await storage.getLead(leadId);
      const campaign = await storage.getCampaign(campaignId);

      if (!lead || !campaign) {
        return res.status(404).json({ error: 'Lead or campaign not found' });
      }

      // Send email using the specified template
      const mailgunService = await import('./mailgun');
      await mailgunService.sendCampaignEmail(
        lead.email,
        campaign.name,
        templateId || campaign.emailTemplate,
        {
          leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Customer',
          vehicleInterest: lead.vehicleInterest,
          dealershipName: 'OneKeel Swarm Demo'
        },
{}
      );

      // Update lead activity
      await storage.updateLead(leadId, {
        status: 'contacted'
      });

      res.status(200).json({ message: 'Campaign executed successfully' });
    } catch (error) {
      console.error('Campaign execution webhook error:', error);
      res.status(500).json({ error: 'Campaign execution failed' });
    }
  }

  private static async handleEmailDelivered(event: any) {
    // Update delivery status
    await this.updateEmailStatus(event['message-id'], 'delivered', {
      deliveredAt: new Date(event.timestamp * 1000),
      recipient: event.recipient
    });
  }

  private static async handleEmailOpened(event: any) {
    // Track email open
    await this.updateEmailStatus(event['message-id'], 'opened', {
      openedAt: new Date(event.timestamp * 1000),
      userAgent: event['user-agent'],
      clientInfo: event['client-info']
    });

    // Update lead engagement score
    if (event.recipient) {
      const lead = await storage.getLeadByEmail(event.recipient);
      if (lead) {
        // Note: qualificationScore field doesn't exist in Lead schema
        console.log(`Email opened by lead: ${lead.email}`);
      }
    }
  }

  private static async handleEmailClicked(event: any) {
    // Track email click
    await this.updateEmailStatus(event['message-id'], 'clicked', {
      clickedAt: new Date(event.timestamp * 1000),
      clickedUrl: event.url,
      userAgent: event['user-agent']
    });

    // Higher engagement score for clicks
    if (event.recipient) {
      const lead = await storage.getLeadByEmail(event.recipient);
      if (lead) {
        // Note: qualificationScore field doesn't exist in Lead schema
        console.log(`Email link clicked by lead: ${lead.email}`);
      }
    }
  }

  private static async handleEmailFailed(event: any) {
    // Track email failure
    await this.updateEmailStatus(event['message-id'], 'failed', {
      failedAt: new Date(event.timestamp * 1000),
      reason: event.reason,
      description: event.description
    });

    // Mark lead as having delivery issues
    if (event.recipient) {
      const lead = await storage.getLeadByEmail(event.recipient);
      if (lead) {
        await storage.updateLead(lead.id, {
          status: 'delivery_failed',
          notes: `Email delivery failed: ${event.reason}`
        });
      }
    }
  }

  private static async handleEmailUnsubscribed(event: any) {
    // Mark lead as unsubscribed
    if (event.recipient) {
      const lead = await storage.getLeadByEmail(event.recipient);
      if (lead) {
        await storage.updateLead(lead.id, {
          status: 'unsubscribed'
        });
      }
    }
  }

  private static async updateEmailStatus(messageId: string, status: string, metadata: any) {
    // This would update the email/communication record
    // For now, we'll just log it since we don't have a communications table in storage
    console.log(`Email ${messageId} status: ${status}`, metadata);
  }

  /**
   * Test webhook endpoint for development
   * Endpoint: POST /api/webhooks/test
   */
  static async handleTest(req: Request, res: Response) {
    try {
      const { type, payload } = req.body;
      
      console.log(`Test webhook received - Type: ${type}`, payload);
      
      res.status(200).json({
        message: 'Test webhook received',
        timestamp: new Date().toISOString(),
        type,
        payload
      });
    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(500).json({ error: 'Test webhook failed' });
    }
  }
}