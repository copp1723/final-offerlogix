import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { storage } from '../storage';

const router = Router();

interface MailgunWebhookEvent {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    event: string;
    recipient: string;
    domain: string;
    timestamp: number;
    'delivery-status'?: {
      code: number;
      description: string;
      message: string;
    };
    reason?: string;
    severity?: string;
    tags?: string[];
    'user-variables'?: Record<string, any>;
  };
}

/**
 * Verify Mailgun webhook signature
 */
function verifyWebhookSignature(body: MailgunWebhookEvent): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  
  if (!signingKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('MAILGUN_WEBHOOK_SIGNING_KEY not set; bypassing signature verification in non-production');
      return true;
    }
    console.error('MAILGUN_WEBHOOK_SIGNING_KEY missing in production');
    return false;
  }

  const { timestamp, token, signature } = body.signature;
  const value = timestamp + token;
  const hash = crypto.createHmac('sha256', signingKey).update(value).digest('hex');
  
  return hash === signature;
}

/**
 * Handle Mailgun delivery events (bounces, complaints, etc.)
 * This webhook improves deliverability by auto-suppressing problematic addresses
 */
router.post('/webhooks/mailgun/events', async (req: Request, res: Response) => {
  try {
    const event: MailgunWebhookEvent = req.body;
    
    // Verify webhook signature
    if (!verifyWebhookSignature(event)) {
      console.error('Invalid Mailgun webhook signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const eventData = event['event-data'];
    const { event: eventType, recipient, reason, severity } = eventData;
    
    console.log(`Mailgun event: ${eventType} for ${recipient}`);

    // Handle different event types
    switch (eventType) {
      case 'failed':
        await handleBounce(recipient, reason, severity, eventData);
        break;
        
      case 'complained':
        await handleComplaint(recipient, eventData);
        break;
        
      case 'unsubscribed':
        await handleUnsubscribe(recipient, eventData);
        break;
        
      case 'delivered':
        await handleDelivered(recipient, eventData);
        break;
        
      case 'opened':
        await handleOpened(recipient, eventData);
        break;
        
      case 'clicked':
        await handleClicked(recipient, eventData);
        break;
        
      default:
        console.log(`Unhandled Mailgun event type: ${eventType}`);
    }

    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('Mailgun webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle bounce events
 */
async function handleBounce(recipient: string, reason?: string, severity?: string, eventData?: any) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    
    if (lead) {
      // Determine if this is a hard or soft bounce
      const isHardBounce = severity === 'permanent' || 
                          (reason && (
                            reason.includes('mailbox does not exist') ||
                            reason.includes('user unknown') ||
                            reason.includes('invalid recipient') ||
                            reason.includes('domain not found')
                          ));
      
      if (isHardBounce) {
        // Hard bounce - suppress immediately
        await storage.updateLead(lead.id, {
          status: 'bounced',
          bounceReason: reason || 'Hard bounce',
          bouncedAt: new Date().toISOString()
        });
        console.log(`Hard bounce suppressed: ${recipient} - ${reason}`);
      } else {
        // Soft bounce - track but don't suppress immediately
        console.log(`Soft bounce tracked: ${recipient} - ${reason}`);
        // Could implement soft bounce counting logic here
      }
    } else {
      // Create suppression record for unknown addresses
      await storage.createLead({
        email: recipient,
        status: 'bounced',
        leadSource: 'bounce_suppression',
        bounceReason: reason || 'Bounce',
        bouncedAt: new Date().toISOString()
      } as any);
      console.log(`Bounce suppression record created: ${recipient}`);
    }
  } catch (error) {
    console.error(`Error handling bounce for ${recipient}:`, error);
  }
}

/**
 * Handle spam complaint events
 */
async function handleComplaint(recipient: string, eventData?: any) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    
    if (lead) {
      await storage.updateLead(lead.id, {
        status: 'complained',
        complainedAt: new Date().toISOString(),
        complaintReason: 'Spam complaint'
      });
    } else {
      // Create suppression record
      await storage.createLead({
        email: recipient,
        status: 'complained',
        leadSource: 'complaint_suppression',
        complainedAt: new Date().toISOString(),
        complaintReason: 'Spam complaint'
      } as any);
    }
    
    console.log(`Spam complaint suppressed: ${recipient}`);
  } catch (error) {
    console.error(`Error handling complaint for ${recipient}:`, error);
  }
}

/**
 * Handle unsubscribe events
 */
async function handleUnsubscribe(recipient: string, eventData?: any) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    
    if (lead) {
      await storage.updateLead(lead.id, {
        status: 'unsubscribed',
        unsubscribedAt: new Date().toISOString(),
        unsubscribeReason: 'mailgun_unsubscribe'
      });
    } else {
      // Create suppression record
      await storage.createLead({
        email: recipient,
        status: 'unsubscribed',
        leadSource: 'unsubscribe_suppression',
        unsubscribedAt: new Date().toISOString(),
        unsubscribeReason: 'mailgun_unsubscribe'
      } as any);
    }
    
    console.log(`Unsubscribe processed: ${recipient}`);
  } catch (error) {
    console.error(`Error handling unsubscribe for ${recipient}:`, error);
  }
}

/**
 * Handle successful delivery events
 */
async function handleDelivered(recipient: string, eventData?: any) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      // Update last successful delivery timestamp
      await storage.updateLead(lead.id, {
        lastEmailDeliveredAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`Error handling delivery for ${recipient}:`, error);
  }
}

/**
 * Handle email open events
 */
async function handleOpened(recipient: string, eventData?: any) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      await storage.updateLead(lead.id, {
        lastEmailOpenedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`Error handling open for ${recipient}:`, error);
  }
}

/**
 * Handle email click events
 */
async function handleClicked(recipient: string, eventData?: any) {
  try {
    const lead = await storage.getLeadByEmail(recipient);
    if (lead) {
      await storage.updateLead(lead.id, {
        lastEmailClickedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`Error handling click for ${recipient}:`, error);
  }
}

/**
 * Health check for webhook service
 */
router.get('/webhooks/mailgun/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'mailgun-webhooks',
    timestamp: new Date().toISOString()
  });
});

export default router;
