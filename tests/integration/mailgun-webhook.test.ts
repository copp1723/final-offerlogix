import request from 'supertest';
import { Express } from 'express';
import { createExpressApp } from '../../server/index';
import { generateSignedWebhook, type SignedWebhook } from '../../scripts/mailgun-sign';

jest.mock('../../server/services/mailgun-webhook-handler', () => {
  const actual = jest.requireActual('../../server/services/mailgun-webhook-handler');
  return {
    ...actual,
    processWebhookEvent: jest.fn(async (event: SignedWebhook) => {
      const { signature } = event;
      // Mock signature verification by calling the actual verification function
      return actual.verifyWebhookSignature ? 
        actual.verifyWebhookSignature(signature.timestamp, signature.token, signature.signature) :
        true; // fallback to success for basic testing
    })
  };
});

describe('Mailgun webhook endpoint', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = 'test-signing-key';
    app = await createExpressApp();
  });

  afterAll(() => {
    delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  });

  it('returns 200 for valid signature', async () => {
    const eventData = {
      event: 'delivered',
      timestamp: Math.floor(Date.now() / 1000),
      id: 'abc123',
      'log-level': 'info',
      severity: 'temporary',
      recipient: 'test@example.com',
      'recipient-domain': 'example.com',
      message: { 
        headers: { 
          'message-id': 'abc123', 
          to: 'test@example.com', 
          from: 'sender@example.com', 
          subject: 'Test' 
        } 
      }
    };
    const body = generateSignedWebhook(eventData);

    await request(app)
      .post('/api/email-reliability/webhook/mailgun')
      .send(body)
      .expect(200);
  });

  it('returns 401 for invalid signature', async () => {
    const eventData = {
      event: 'opened',
      timestamp: Math.floor(Date.now() / 1000),
      id: 'abc123',
      'log-level': 'info',
      severity: 'temporary',
      recipient: 'test@example.com',
      'recipient-domain': 'example.com',
      message: { 
        headers: { 
          'message-id': 'abc123', 
          to: 'test@example.com', 
          from: 'sender@example.com', 
          subject: 'Test' 
        } 
      }
    };
    const body = generateSignedWebhook(eventData);
    body.signature.signature = 'bad-signature';

    await request(app)
      .post('/api/email-reliability/webhook/mailgun')
      .send(body)
      .expect(401);
  });

  it('handles malformed webhook payload', async () => {
    await request(app)
      .post('/api/email-reliability/webhook/mailgun')
      .send({ invalid: 'payload' })
      .expect(500);
  });
});