import request from 'supertest';
import { Express } from 'express';
import { createExpressApp } from '../../server/index';

// Mock dependencies for inbound email processing
jest.mock('../../server/services/inbound-email', () => {
  const mockHandleInboundEmail = jest.fn(async (req: any, res: any) => {
    // Simple mock implementation that returns success
    res.status(200).json({ message: 'Email processed successfully' });
  });

  return {
    InboundEmailService: {
      handleInboundEmail: mockHandleInboundEmail,
    },
  };
});

describe('Mailgun inbound webhook endpoint', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createExpressApp();
  });

  it('processes inbound email webhook successfully', async () => {
    const payload = {
      sender: 'test@example.com',
      recipient: 'inbound@company.com',
      subject: 'Test Reply',
      'body-plain': 'This is a test reply message',
      'stripped-text': 'This is a test reply message',
      'message-id': '<test-message-123@example.com>',
      timestamp: Math.floor(Date.now() / 1000),
      token: 'test-token',
      signature: 'test-signature',
    };

    const response = await request(app)
      .post('/api/webhooks/mailgun/inbound')
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ message: 'Email processed successfully' });
  });

  it('handles malformed inbound webhook payload', async () => {
    await request(app)
      .post('/api/webhooks/mailgun/inbound')
      .send({ invalid: 'payload' })
      .expect(500);
  });
});