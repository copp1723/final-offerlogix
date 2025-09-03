import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import crypto from 'crypto';
import { validateMailgunWebhook, validateWebhook } from '../../server/middleware/webhook-validation.js';

// Mock the dependencies
jest.mock('../../server/services/mailgun-webhook-handler.js', () => ({
  verifyWebhookSignature: jest.fn()
}));

jest.mock('../../server/logging/logger.js', () => ({
  default: {
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('Webhook Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = 'test-signing-key';
    
    mockRequest = {
      body: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.MAILGUN_WEBHOOK_SIGNING_KEY = originalEnv;
    } else {
      delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    }
  });

  describe('validateMailgunWebhook', () => {
    const createValidWebhookPayload = () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const token = crypto.randomBytes(16).toString('hex');
      
      return {
        signature: {
          timestamp,
          token,
          signature: 'valid-signature-hash'
        },
        'event-data': {
          event: 'delivered',
          recipient: 'test@example.com',
          timestamp: Date.now() / 1000
        }
      };
    };

    it('should pass validation with valid signature', async () => {
      const { verifyWebhookSignature } = await import('../../server/services/mailgun-webhook-handler.js');
      (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      
      mockRequest.body = createValidWebhookPayload();

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(verifyWebhookSignature).toHaveBeenCalledWith(
        mockRequest.body.signature.timestamp,
        mockRequest.body.signature.token,
        mockRequest.body.signature.signature
      );
      
      expect(mockRequest.webhookVerified).toBe(true);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      const { verifyWebhookSignature } = await import('../../server/services/mailgun-webhook-handler.js');
      (verifyWebhookSignature as jest.Mock).mockReturnValue(false);
      
      mockRequest.body = createValidWebhookPayload();

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject webhook missing signature data', () => {
      mockRequest.body = {
        'event-data': {
          event: 'delivered',
          recipient: 'test@example.com'
        }
      };

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject webhook missing timestamp', () => {
      mockRequest.body = {
        signature: {
          token: 'test-token',
          signature: 'test-signature'
        },
        'event-data': {
          event: 'delivered'
        }
      };

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject webhook missing token', () => {
      mockRequest.body = {
        signature: {
          timestamp: Math.floor(Date.now() / 1000).toString(),
          signature: 'test-signature'
        },
        'event-data': {
          event: 'delivered'
        }
      };

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject webhook missing signature', () => {
      mockRequest.body = {
        signature: {
          timestamp: Math.floor(Date.now() / 1000).toString(),
          token: 'test-token'
        },
        'event-data': {
          event: 'delivered'
        }
      };

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle verification errors gracefully', async () => {
      const { verifyWebhookSignature } = await import('../../server/services/mailgun-webhook-handler.js');
      (verifyWebhookSignature as jest.Mock).mockImplementation(() => {
        throw new Error('Verification error');
      });
      
      mockRequest.body = createValidWebhookPayload();

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Webhook validation failed' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log debug information on successful validation', async () => {
      const { verifyWebhookSignature } = await import('../../server/services/mailgun-webhook-handler.js');
      const logger = (await import('../../server/logging/logger.js')).default;
      
      (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      
      const payload = createValidWebhookPayload();
      mockRequest.body = payload;

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(logger.debug).toHaveBeenCalledWith(
        'Webhook signature verified successfully',
        {
          timestamp: payload.signature.timestamp,
          eventType: payload['event-data'].event
        }
      );
    });

    it('should log warning on signature verification failure', async () => {
      const { verifyWebhookSignature } = await import('../../server/services/mailgun-webhook-handler.js');
      const logger = (await import('../../server/logging/logger.js')).default;
      
      (verifyWebhookSignature as jest.Mock).mockReturnValue(false);
      
      const payload = createValidWebhookPayload();
      mockRequest.body = payload;

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Webhook signature verification failed',
        {
          timestamp: payload.signature.timestamp,
          token: payload.signature.token
        }
      );
    });
  });

  describe('validateWebhook', () => {
    it('should use mailgun validation for mailgun provider', async () => {
      const { verifyWebhookSignature } = await import('../../server/services/mailgun-webhook-handler.js');
      (verifyWebhookSignature as jest.Mock).mockReturnValue(true);
      
      mockRequest.body = {
        signature: {
          timestamp: Math.floor(Date.now() / 1000).toString(),
          token: 'test-token',
          signature: 'test-signature'
        },
        'event-data': {
          event: 'delivered'
        }
      };

      const middleware = validateWebhook('mailgun');
      
      middleware(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(verifyWebhookSignature).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unknown provider', () => {
      const middleware = validateWebhook('other' as any);
      
      middleware(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unknown webhook provider' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log warning for unknown provider', () => {
      const logger = require('../../server/logging/logger.js').default;
      
      const middleware = validateWebhook('unknown' as any);
      
      middleware(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'Unknown webhook provider',
        { provider: 'unknown' }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty request body', () => {
      mockRequest.body = {};

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
    });

    it('should handle null request body', () => {
      mockRequest.body = null;

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
    });

    it('should handle request body with empty signature object', () => {
      mockRequest.body = {
        signature: {},
        'event-data': {
          event: 'delivered'
        }
      };

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
    });

    it('should handle request body with empty string values', () => {
      mockRequest.body = {
        signature: {
          timestamp: '',
          token: '',
          signature: ''
        },
        'event-data': {
          event: 'delivered'
        }
      };

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
    });

    it('should handle malformed signature data', () => {
      mockRequest.body = {
        signature: 'not-an-object',
        'event-data': {
          event: 'delivered'
        }
      };

      validateMailgunWebhook(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid webhook payload' });
    });
  });
});