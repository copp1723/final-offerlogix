import request from 'supertest';
import { Express } from 'express';
import { createExpressApp } from '../../server/index';
import { storage } from '../../server/storage';

// Mock external dependencies
jest.mock('../../server/services/websocket', () => ({
  webSocketService: {
    broadcast: jest.fn(),
    emit: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../../server/integrations/supermemory', () => ({
  isRAGEnabled: jest.fn(() => false),
}));

// Mock storage methods
jest.mock('../../server/storage', () => ({
  storage: {
    getCampaign: jest.fn(),
    getEmailTemplates: jest.fn(),
    updateCampaign: jest.fn(),
    getLeads: jest.fn(),
    getLead: jest.fn(),
  }
}));

// Mock mailgun service
jest.mock('../../server/services/email/mailgun-service', () => ({
  mailgunService: {
    sendBulkEmails: jest.fn(),
  }
}));

// Mock template renderer
jest.mock('../../server/services/template-renderer', () => ({
  getLatestTemplate: jest.fn(),
  renderTemplate: jest.fn(),
}));

describe('Templates API Integration', () => {
  let app: Express;

  const mockCampaign = {
    id: '1',
    name: 'Test Campaign',
    status: 'draft',
    templates: '[]'
  };

  const mockTemplate = {
    id: 1,
    campaignId: 1,
    subject: 'Test Subject',
    content: 'Hello {{firstName}}!',
    createdAt: new Date().toISOString()
  };

  const mockLead = {
    id: '1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    campaignId: '1'
  };

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SKIP_AUTH = 'true';
    
    app = await createExpressApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mocks
    (storage.getCampaign as jest.Mock).mockResolvedValue(mockCampaign);
    const { getLatestTemplate, renderTemplate } = require('../../server/services/template-renderer');
    getLatestTemplate.mockResolvedValue(mockTemplate);
    renderTemplate.mockReturnValue('Hello John!');
  });

  afterAll(() => {
    delete process.env.SKIP_AUTH;
  });

  it('handles missing templates route gracefully', async () => {
    const res = await request(app)
      .get('/api/templates')
      .expect(404);
    
    expect(res.body).toHaveProperty('error');
  });

  it('allows access to AI routes when SKIP_AUTH is enabled', async () => {
    const res = await request(app)
      .post('/api/ai/suggest-goals')
      .send({ context: 'test context' });
    
    // Should not return 401 (auth required)
    expect(res.status).not.toBe(401);
  });

  it('returns branding configuration', async () => {
    const res = await request(app)
      .get('/api/branding')
      .expect(200);
    
    expect(res.body).toBeDefined();
  });

  it('validates health endpoint', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect(200);
    
    expect(res.body).toHaveProperty('status');
    expect(res.body.status).toBe('healthy');
  });

  describe('Template Rendering Endpoints', () => {
    describe('GET /api/campaigns/:id/preview', () => {
      it('should preview template with variables', async () => {
        const response = await request(app)
          .get('/api/campaigns/1/preview?firstName=John&lastName=Doe')
          .expect(200);

        expect(response.body).toMatchObject({
          templateId: 1,
          subject: 'Test Subject',
          content: 'Hello John!',
          previewUrl: '/api/campaigns/1/preview',
          variables: ['firstName', 'lastName']
        });
      });

      it('should return 404 for non-existent campaign', async () => {
        (storage.getCampaign as jest.Mock).mockResolvedValue(null);

        await request(app)
          .get('/api/campaigns/999/preview')
          .expect(404)
          .expect(res => {
            expect(res.body.message).toBe('Campaign not found');
          });
      });

      it('should return 404 for campaign without template', async () => {
        const { getLatestTemplate } = require('../../server/services/template-renderer');
        getLatestTemplate.mockResolvedValue(null);

        await request(app)
          .get('/api/campaigns/1/preview')
          .expect(404)
          .expect(res => {
            expect(res.body.message).toBe('No template found for campaign');
          });
      });
    });

    describe('POST /api/campaigns/:id/send', () => {
      beforeEach(() => {
        (storage.getLeads as jest.Mock).mockResolvedValue([mockLead]);
        (storage.getLead as jest.Mock).mockResolvedValue(mockLead);
        (storage.updateCampaign as jest.Mock).mockResolvedValue(mockCampaign);
        
        const { mailgunService } = require('../../server/services/email/mailgun-service');
        mailgunService.sendBulkEmails.mockResolvedValue({
          sent: 1,
          failed: 0,
          errors: []
        });
      });

      it('should send campaign to all leads', async () => {
        const response = await request(app)
          .post('/api/campaigns/1/send')
          .send({
            variables: { companyName: 'Test Corp' }
          })
          .expect(200);

        expect(response.body).toMatchObject({
          message: 'Campaign sent successfully',
          campaignId: 1,
          templateId: 1,
          totalLeads: 1,
          successful: 1,
          failed: 0
        });

        expect(storage.updateCampaign).toHaveBeenCalledWith('1', {
          status: 'sent'
        });
      });

      it('should return 400 when no leads found', async () => {
        (storage.getLeads as jest.Mock).mockResolvedValue([]);

        await request(app)
          .post('/api/campaigns/1/send')
          .send({})
          .expect(400)
          .expect(res => {
            expect(res.body.message).toBe('No target leads found');
          });
      });
    });
  });
});