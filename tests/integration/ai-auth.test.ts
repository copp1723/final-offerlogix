import request from 'supertest';
import express, { Express } from 'express';

import { MockStorageService } from '../utils/test-helpers';

jest.mock('../../server/storage', () => ({
  storage: new MockStorageService(),
}));

jest.mock('../../server/services/websocket', () => ({
  webSocketService: {
    broadcast: jest.fn(),
    emit: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../../server/services/email/mailgun-service', () => ({
  mailgunService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-123' }),
    verifyDomain: jest.fn().mockResolvedValue({ verified: true }),
  },
}));

jest.mock('../../server/services/openai', () => ({
  suggestCampaignGoals: jest.fn(),
  enhanceEmailTemplates: jest.fn(),
  generateSubjectLines: jest.fn(),
  suggestCampaignNames: jest.fn(),
  generateEmailTemplates: jest.fn().mockResolvedValue([
    { subject: 'Test', html: '<p>Test</p>', text: 'Test' },
  ]),
}));

import { registerRoutes } from '../../server/routes';

const createApp = async (): Promise<Express> => {
  const app = express();
  await registerRoutes(app);
  return app;
};

describe('AI route authentication', () => {
  let originalEnv: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.SKIP_AUTH;
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.SKIP_AUTH = originalEnv;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('bypasses auth when SKIP_AUTH=true in non-production', async () => {
    process.env.SKIP_AUTH = 'true';
    process.env.NODE_ENV = 'development';
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/generate-templates')
      .send({ context: 'ctx', name: 'name' });
    expect(res.status).toBe(200);
    expect(res.body.templates).toBeDefined();
  });

  it('requires auth when SKIP_AUTH is not true', async () => {
    process.env.SKIP_AUTH = 'false';
    process.env.NODE_ENV = 'development';
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/generate-templates')
      .send({ context: 'ctx', name: 'name' });
    expect(res.status).toBe(401);
  });

  it('requires auth in production even with SKIP_AUTH=true', async () => {
    process.env.SKIP_AUTH = 'true';
    process.env.NODE_ENV = 'production';
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/generate-templates')
      .send({ context: 'ctx', name: 'name' });
    expect(res.status).toBe(401);
  });

  it('applies to suggest-goals endpoint', async () => {
    process.env.SKIP_AUTH = 'true';
    process.env.NODE_ENV = 'test';
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/suggest-goals')
      .send({ context: 'test context' });
    expect(res.status).toBe(200);
  });

  it('applies to suggest-names endpoint', async () => {
    process.env.SKIP_AUTH = 'true';
    process.env.NODE_ENV = 'test';
    const app = await createApp();
    const res = await request(app)
      .post('/api/ai/suggest-names')
      .send({ context: 'test context' });
    expect(res.status).toBe(200);
  });
});