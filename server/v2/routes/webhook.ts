/**
 * V2 Webhook Routes
 * Handles Mailgun webhooks for V2 message status updates
 */

import express, { Request, Response } from 'express';
import { V2WebhookHandler } from '../services/webhook/V2WebhookHandler';
import logger from '../../logging/logger';

const router = express.Router();
const webhookHandler = new V2WebhookHandler();

/**
 * Mailgun webhook endpoint for V2 messages
 * This endpoint should not require authentication as it's called by Mailgun
 */
router.post('/mailgun', async (req: Request, res: Response) => {
  try {
    logger.info('V2 webhook received', {
      body: JSON.stringify(req.body, null, 2),
      headers: req.headers
    });

    const success = await webhookHandler.processWebhookEvent(req.body);
    
    if (success) {
      res.status(200).json({ received: true, version: 'v2' });
    } else {
      res.status(400).json({ error: 'Failed to process webhook', version: 'v2' });
    }
  } catch (error) {
    logger.error('V2 webhook processing failed', { 
      error: error instanceof Error ? error.message : error,
      body: req.body 
    });
    res.status(500).json({ error: 'Internal server error', version: 'v2' });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    version: 'v2',
    timestamp: new Date().toISOString()
  });
});

export default router;
