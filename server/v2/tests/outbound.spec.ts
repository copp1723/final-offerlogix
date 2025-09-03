import express from 'express';
import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock dbV2 to return a fake agent without hitting a database
jest.mock('../db', () => {
  const agent = { id: 'agent-1', name: 'Riley Donovan', domain: 'mg.example.com', localPart: 'riley' };
  return {
    dbV2: {
      select: () => ({
        from: () => ({
          where: async () => [agent],
        }),
      }),
    },
    v2schema: {
      agents: { id: 'id', name: 'name', domain: 'domain', localPart: 'localPart' },
      messages: {},
      conversations: {},
    },
  };
});

// Mock factory to return a stubbed ConversationEngine instance
jest.mock('../services/conversation/factory', () => {
  return {
    makeConversationEngine: () => ({
      sendManualEmail: (..._args: any[]) => Promise.resolve({ messageId: '<abc123@mg.example.com>', conversationId: 'conv-1' }),
    })
  };
});

import { buildV2Router } from '../routes';

describe('v2:mailgun outbound route', () => {
  const prevEnv = { ...process.env };
  let app: express.Express;

  beforeAll(() => {
    process.env.V2_MAILGUN_ENABLED = 'true';
    process.env.MAILGUN_DOMAIN = 'mg.example.com';
    process.env.MAILGUN_BASE = 'https://api.mailgun.net/v3';
    process.env.MAILGUN_API_KEY = 'key-test';
    process.env.NODE_ENV = 'test';
    app = express();
    app.use(express.json());
    app.use('/v2', buildV2Router());
  });

  afterAll(() => {
    process.env = prevEnv;
  });

  test('returns 200 and echoes threading core Message-Id and identity', async () => {
    const res = await request(app)
      .post('/v2/outbound/test')
      .send({
        agentId: 'agent-1',
        to: 'lead@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

    expect(res.status).toBe(200);
    expect(res.body.messageId).toBe('<abc123@mg.example.com>');
    expect(res.body.from).toBe('Riley Donovan <riley@mg.example.com>');
    expect(res.body.replyTo).toBe('Riley Donovan <riley@mg.example.com>');
  });
});
