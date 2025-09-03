import { Request, Response, NextFunction } from 'express';
import logger from '../logging/logger';

/**
 * Webhook validation middleware for Mailgun inbound webhooks
 */
export const validateMailgunWebhook = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic request validation
    if (!req.body) {
      logger.warn('Webhook validation: Empty request body');
      return res.status(400).json({ error: 'Empty request body' });
    }

    // Check for required Mailgun fields
    const requiredFields = ['sender', 'recipient', 'timestamp', 'token', 'signature'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      logger.warn('Webhook validation: Missing required fields', { missingFields });
      return res.status(400).json({ error: 'Missing required fields', fields: missingFields });
    }

    // Log webhook reception for monitoring
    logger.info('Webhook validation: Mailgun webhook received', {
      sender: req.body.sender,
      recipient: req.body.recipient,
      subject: req.body.subject,
      timestamp: req.body.timestamp
    });

    next();
  } catch (error) {
    logger.error('Webhook validation error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ error: 'Webhook validation failed' });
  }
};

export default validateMailgunWebhook;