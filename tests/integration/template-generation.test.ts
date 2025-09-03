import request from 'supertest';
import express, { Express } from 'express';
import { registerRoutes } from '../../server/routes';
import { MockStorageService } from '../utils/test-helpers';

const mockStorage = new MockStorageService();

jest.mock('../../server/storage', () => ({
  storage: mockStorage,
}));

jest.mock('../../server/services/openai', () => ({
  generateEmailTemplates: jest.fn(),
}));

import { generateEmailTemplates } from '../../server/services/openai';

describe('POST /api/campaigns/:id/templates/generate', () => {
  let app: Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  beforeEach(() => {
    mockStorage.reset();
    mockStorage.seedData({ campaigns: [{ id: 'c1', name: 'Test', context: 'ctx' }] });
    (generateEmailTemplates as jest.Mock).mockResolvedValue([
      { subject: 'Hello', content: '<p>Hi</p>', text: 'Hi' },
    ]);
  });

  it('returns created template', async () => {
    const res = await request(app)
      .post('/api/campaigns/c1/templates/generate')
      .expect(201);
    expect(res.body).toMatchObject({ campaignId: 'c1', subject: 'Hello', version: 1 });
  });

  it('returns 404 for invalid campaign', async () => {
    await request(app)
      .post('/api/campaigns/unknown/templates/generate')
      .expect(404);
  });

  it('handles AI failure', async () => {
    (generateEmailTemplates as jest.Mock).mockRejectedValue(new Error('fail'));
    await request(app)
      .post('/api/campaigns/c1/templates/generate')
      .expect(500);
  });
});