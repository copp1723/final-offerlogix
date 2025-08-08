import { Request, Response } from 'express';
import { storage } from '../storage';
import { liveConversationService } from './live-conversation';
import { InboundEmailService } from './inbound-email';
import { predictiveOptimizationService } from './predictive-optimization-instance';

export class WebhookHandler {
  /**
   * Handle Mailgun webhook events for email tracking
   */
  static async handleMailgunEvents(req: Request, res: Response) {
    try {
      const event = req.body;
      
      if (!event.event || !event['message-id']) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      // Try to extract campaignId from Mailgun metadata/variables if present
      // Ensure you pass `o:tracking` vars or custom headers when sending emails.
      const campaignId: string | undefined =
        event['user-variables']?.campaignId ||
        event['campaign-id'] ||
        event.campaignId ||
        undefined;
      const recipient: string | undefined = event.recipient;
      const msgId: string = event['message-id'];
      const ts = event.timestamp ? new Date(event.timestamp * 1000) : new Date();

      // Process different event types
      switch (event.event) {
        case 'delivered':
          await this.handleEmailDelivered(event);
          break;
        case 'opened':
          await this.handleEmailOpened(event);
          // Ingest open into predictive service if we have campaign context
          if (campaignId && recipient) {
            try { predictiveOptimizationService.ingestOpen(msgId, campaignId, recipient, ts); } catch {}
          }
          break;
        case 'clicked':
          await this.handleEmailClicked(event);
          if (campaignId && recipient) {
            try { predictiveOptimizationService.ingestClick(msgId, campaignId, recipient, event.url, ts); } catch {}
          }
          break;
        case 'bounced':
        case 'failed':
          await this.handleEmailFailed(event);
          break;
        default:
          console.log(`Unhandled Mailgun event: ${event.event}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Mailgun webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle successful email delivery
   */
  private static async handleEmailDelivered(event: any) {
    console.log(`Email delivered: ${event['message-id']} to ${event.recipient}`);
    
    // Update delivery status if needed
    // You might want to track this in your database
  }

  /**
   * Handle email opens
   */
  private static async handleEmailOpened(event: any) {
    console.log(`Email opened: ${event['message-id']} by ${event.recipient}`);
    
    // Track email open metrics
    // Update engagement data
  }

  /**
   * Handle email clicks
   */
  private static async handleEmailClicked(event: any) {
    console.log(`Email clicked: ${event['message-id']} by ${event.recipient} - URL: ${event.url}`);
    
    // Track click metrics
    // Update engagement data
  }

  /**
   * Handle email failures/bounces
   */
  private static async handleEmailFailed(event: any) {
    console.log(`Email failed: ${event['message-id']} to ${event.recipient} - Reason: ${event.reason}`);
    
    // Track failure metrics
    // Update lead status if hard bounce
    try {
      const leads = await storage.getLeads();
      const lead = leads.find(l => l.email === event.recipient);
      
      if (lead && event.severity === 'permanent') {
        await storage.updateLead(lead.id, {
          status: 'bounced'
        });
      }
    } catch (error) {
      console.error('Failed to update lead status for bounced email:', error);
    }
  }

  /**
   * Handle inbound email webhooks
   */
  static async handleInboundEmail(req: Request, res: Response) {
    try {
      const emailData = req.body;
      
      // Process inbound email using the InboundEmailService
      if ('processInboundEmail' in InboundEmailService) {
        await (InboundEmailService as any).processInboundEmail(emailData);
      } else {
        console.log('InboundEmailService.processInboundEmail not available, logging email data:', emailData);
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Inbound email webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}