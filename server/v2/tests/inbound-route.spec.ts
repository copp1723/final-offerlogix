import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
jest.mock('../services/conversation/ConversationEngine', () => {
  const mod: any = { ConversationEngine: { processInbound: jest.fn(), sendEmail: jest.fn() } };
  return mod;
});
import { buildV2Router } from '../routes';

// Mock dbV2 to avoid real database operations for inbound flow
jest.mock('../db', () => {
  return {
    dbV2: {
      select: () => ({
        from: () => ({
          where: async () => [
            { id: 'agent-1', name: 'Riley Donovan', domain: 'mg.example.com', localPart: 'riley' },
          ],
        }),
      }),
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({ returning: async () => [{ id: 'conv-1' }] }),
          returning: async () => [{ id: 'conv-1' }],
        }),
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    },
    v2schema: {
      agents: {},
      conversations: {},
      messages: {},
    },
  };
});

describe('v2:mailgun inbound route signature', () => {
  const prevEnv = { ...process.env };
  let app: express.Express;

  beforeAll(() => {
    process.env.V2_MAILGUN_ENABLED = 'true';
    process.env.MAILGUN_SIGNING_KEY = 'test_signing_key';
    app = express();
    app.use(express.json());
    app.use('/v2', buildV2Router());
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  test('valid signature -> 204', async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const token = 'abc123';
    const signature = crypto.createHmac('sha256', process.env.MAILGUN_SIGNING_KEY as string).update(`${timestamp}${token}`).digest('hex');

    const body = {
      signature: { timestamp, token, signature },
      recipient: 'riley@mg.example.com',
      sender: 'lead@example.com',
      subject: 'Hello',
      'Message-Id': '<incoming@lead.com>',
      'body-plain': 'Hi',
    };

    const res = await request(app).post('/v2/inbound/mailgun').send(body);
    expect(res.status).toBe(204);
  });

  test('invalid signature -> 401', async () => {
    const body = {
      signature: { timestamp: '0', token: 'x', signature: 'bad' },
      recipient: 'riley@mg.example.com',
      sender: 'lead@example.com',
      subject: 'Hello',
      'Message-Id': '<incoming@lead.com>',
      'body-plain': 'Hi',
    };

    const res = await request(app).post('/v2/inbound/mailgun').send(body);
    expect(res.status).toBe(401);
  });
});
