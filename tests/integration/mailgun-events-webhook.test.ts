import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import crypto from 'crypto';
import { setupTestDatabase, cleanupTestDatabase, createTestClient, createTestCampaign, createTestLead } from '../utils/test-helpers.js';

// Test server setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import the routes after setting up the app
let server: any;

describe('Mailgun Events Webhook Integration Tests', () => {
  let testClient: any;
  let testCampaign: any;
  let testLead: any;
  let webhookSigningKey: string;

  beforeEach(async () => {
    await setupTestDatabase();
    
    // Set webhook signing key for tests
    webhookSigningKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || 'test-webhook-key';
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = webhookSigningKey;
    
    // Create test data
    testClient = await createTestClient();
    testCampaign = await createTestCampaign(testClient.id);
    testLead = await createTestLead(testClient.id, testCampaign.id);

    // Dynamically import and setup the server after env is set
    const { createApp } = await import('../../server/index.js');
    const testApp = await createApp();
    server = createServer(testApp);
  });

  afterEach(async () => {
    if (server) {
      server.close();
    }
    await cleanupTestDatabase();
  });

  const createWebhookSignature = (timestamp: string, token: string): string => {
    return crypto
      .createHmac('sha256', webhookSigningKey)
      .update(`${timestamp}${token}`)
      .digest('hex');
  };

  const createMailgunEvent = (eventType: string, overrides: any = {}) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = crypto.randomBytes(16).toString('hex');
    const signature = createWebhookSignature(timestamp, token);

    return {
      signature: {
        timestamp,
        token,
        signature
      },
      'event-data': {
        event: eventType,
        timestamp: Date.now() / 1000,
        id: `test-event-${Date.now()}`,
        'log-level': 'info',
        severity: 'permanent',
        recipient: testLead.email,
        message: {
          headers: {
            'message-id': `test-message-${Date.now()}@mailgun.com`,
            to: testLead.email,
            from: 'noreply@test.com',
            subject: 'Test Email'
          }
        },
        'user-variables': {
          campaignId: testCampaign.id,
          leadId: testLead.id,
          clientId: testClient.id
        },
        ...overrides
      }
    };
  };

  describe('POST /api/webhooks/mailgun/events', () => {
    it('should process delivered event successfully', async () => {
      const webhookEvent = createMailgunEvent('delivered');

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should process opened event successfully', async () => {
      const webhookEvent = createMailgunEvent('opened', {
        'client-info': {
          'user-agent': 'Mozilla/5.0 Test Browser',
          'client-name': 'Gmail',
          'device-type': 'desktop'
        },
        geolocation: {
          city: 'San Francisco',
          region: 'California',
          country: 'US'
        }
      });

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should process clicked event successfully', async () => {
      const webhookEvent = createMailgunEvent('clicked', {
        url: 'https://example.com/link',
        'client-info': {
          'user-agent': 'Mozilla/5.0 Test Browser'
        }
      });

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should process failed/bounced event successfully', async () => {
      const webhookEvent = createMailgunEvent('failed', {
        severity: 'permanent',
        reason: 'No such mailbox',
        'delivery-status': {
          'attempt-no': 1,
          message: 'No such mailbox',
          code: 550,
          description: 'Permanent failure',
          'session-seconds': 0.123
        }
      });

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should process complained event successfully', async () => {
      const webhookEvent = createMailgunEvent('complained');

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should reject webhook with invalid signature', async () => {
      const webhookEvent = createMailgunEvent('delivered');
      webhookEvent.signature.signature = 'invalid-signature';

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid webhook signature' });
    });

    it('should reject webhook with missing signature data', async () => {
      const webhookEvent = {
        'event-data': {
          event: 'delivered',
          recipient: testLead.email
        }
      };

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid webhook payload' });
    });

    it('should reject webhook with old timestamp', async () => {
      const oldTimestamp = Math.floor((Date.now() - (20 * 60 * 1000)) / 1000).toString(); // 20 minutes ago
      const token = crypto.randomBytes(16).toString('hex');
      const signature = createWebhookSignature(oldTimestamp, token);

      const webhookEvent = {
        signature: {
          timestamp: oldTimestamp,
          token,
          signature
        },
        'event-data': {
          event: 'delivered',
          recipient: testLead.email
        }
      };

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(401);

      expect(response.body).toEqual({ error: 'Invalid webhook signature' });
    });

    it('should handle duplicate webhooks gracefully', async () => {
      const webhookEvent = createMailgunEvent('delivered');

      // Send the same event twice
      await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      // Second request should also succeed but be deduplicated
      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should handle webhook without user variables', async () => {
      const webhookEvent = createMailgunEvent('delivered');
      delete webhookEvent['event-data']['user-variables'];

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should handle unsubscribe event', async () => {
      const webhookEvent = createMailgunEvent('unsubscribed');

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });

    it('should handle webhook with rate limiting', async () => {
      const webhookEvent = createMailgunEvent('delivered');
      const requests = [];

      // Make multiple rapid requests to test rate limiting
      for (let i = 0; i < 25; i++) {
        const eventCopy = JSON.parse(JSON.stringify(webhookEvent));
        eventCopy['event-data'].id = `test-event-${Date.now()}-${i}`;
        eventCopy.signature.token = crypto.randomBytes(16).toString('hex');
        eventCopy.signature.signature = createWebhookSignature(
          eventCopy.signature.timestamp,
          eventCopy.signature.token
        );
        
        requests.push(
          request(server)
            .post('/api/webhooks/mailgun/events')
            .send(eventCopy)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some should succeed, some might be rate limited
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount + rateLimitedCount).toBe(25);
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Conversation Integration', () => {
    it('should integrate with conversation orchestrator for email events', async () => {
      // This test would verify that conversation events are properly coordinated
      // We can't test the actual integration without mocking, but we can test
      // that the webhook processing doesn't break
      
      const webhookEvent = createMailgunEvent('opened');

      const response = await request(server)
        .post('/api/webhooks/mailgun/events')
        .send(webhookEvent)
        .expect(200);

      expect(response.body).toEqual({ message: 'Event processed' });
    });
  });
});