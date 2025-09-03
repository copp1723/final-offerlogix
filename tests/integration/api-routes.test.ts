/**
 * Integration tests for API routes
 */

import request from 'supertest';
import { Express } from 'express';
import { TestDataFactory, MockStorageService } from '../utils/test-helpers';
import { SAMPLE_LEADS, SAMPLE_CAMPAIGNS, VALID_CSV_CONTENT } from '../fixtures/test-data';

// Mock the storage module
jest.mock('../../server/storage', () => ({
  storage: new MockStorageService()
}));

// Mock external services
jest.mock('../../server/services/websocket', () => ({
  webSocketService: {
    broadcast: jest.fn(),
    emit: jest.fn(),
  }
}));

jest.mock('../../server/services/email/mailgun-service', () => ({
  mailgunService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-123' }),
    verifyDomain: jest.fn().mockResolvedValue({ verified: true }),
  }
}));

import { storage } from '../../server/storage';
import { createExpressApp } from '../../server/index'; // Assume we export app creation function

describe('API Routes Integration Tests', () => {
  let app: Express;
  let mockStorage: MockStorageService;

  beforeAll(async () => {
    app = await createExpressApp();
    mockStorage = storage as any;
  });

  beforeEach(() => {
    mockStorage.reset();
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });
  });

  describe('Leads API', () => {
    describe('GET /api/leads', () => {
      it('should return all leads', async () => {
        mockStorage.seedData({ leads: SAMPLE_LEADS });

        const response = await request(app)
          .get('/api/leads')
          .expect(200);

        expect(response.body).toHaveLength(3);
        expect(response.body[0]).toMatchObject({
          id: expect.any(String),
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        });
      });

      it('should filter leads by status', async () => {
        mockStorage.seedData({ leads: SAMPLE_LEADS });

        const response = await request(app)
          .get('/api/leads?status=new')
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].status).toBe('new');
      });

      it('should filter leads by campaign', async () => {
        mockStorage.seedData({ leads: SAMPLE_LEADS });

        const response = await request(app)
          .get('/api/leads?campaignId=campaign-001')
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].campaignId).toBe('campaign-001');
      });
    });

    describe('GET /api/leads/:id', () => {
      it('should return a specific lead', async () => {
        const lead = TestDataFactory.createMockLead();
        mockStorage.seedData({ leads: [lead] });

        const response = await request(app)
          .get(`/api/leads/${lead.id}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: lead.id,
          firstName: lead.firstName,
          email: lead.email
        });
      });

      it('should return 404 for non-existent lead', async () => {
        const response = await request(app)
          .get('/api/leads/nonexistent-id')
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.stringContaining('not found')
        });
      });
    });

    describe('POST /api/leads', () => {
      it('should create a new lead', async () => {
        const leadData = {
          firstName: 'Test',
          lastName: 'User',
          email: 'test.user@example.com',
          phone: '555-0123',
          vehicleInterest: 'SUV'
        };

        const response = await request(app)
          .post('/api/leads')
          .send(leadData)
          .expect(201);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          firstName: 'Test',
          lastName: 'User',
          email: 'test.user@example.com',
          status: 'new'
        });
      });

      it('should validate required fields', async () => {
        const invalidData = {
          firstName: 'Test',
          // missing email
        };

        const response = await request(app)
          .post('/api/leads')
          .send(invalidData)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.stringContaining('email')
        });
      });

      it('should prevent duplicate emails', async () => {
        const existingLead = TestDataFactory.createMockLead({ email: 'duplicate@example.com' });
        mockStorage.seedData({ leads: [existingLead] });

        const duplicateData = {
          firstName: 'Duplicate',
          lastName: 'User',
          email: 'duplicate@example.com'
        };

        const response = await request(app)
          .post('/api/leads')
          .send(duplicateData)
          .expect(409);

        expect(response.body).toMatchObject({
          error: expect.stringContaining('already exists')
        });
      });
    });

    describe('PUT /api/leads/:id', () => {
      it('should update an existing lead', async () => {
        const lead = TestDataFactory.createMockLead();
        mockStorage.seedData({ leads: [lead] });

        const updateData = {
          firstName: 'Updated',
          status: 'contacted'
        };

        const response = await request(app)
          .put(`/api/leads/${lead.id}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          id: lead.id,
          firstName: 'Updated',
          status: 'contacted'
        });
      });

      it('should return 404 for non-existent lead', async () => {
        const response = await request(app)
          .put('/api/leads/nonexistent-id')
          .send({ firstName: 'Updated' })
          .expect(404);

        expect(response.body).toMatchObject({
          error: expect.stringContaining('not found')
        });
      });
    });

    describe('DELETE /api/leads/:id', () => {
      it('should delete an existing lead', async () => {
        const lead = TestDataFactory.createMockLead();
        mockStorage.seedData({ leads: [lead] });

        await request(app)
          .delete(`/api/leads/${lead.id}`)
          .expect(204);

        // Verify lead is deleted
        const leads = await mockStorage.getLeads();
        expect(leads).toHaveLength(0);
      });

      it('should return 404 for non-existent lead', async () => {
        await request(app)
          .delete('/api/leads/nonexistent-id')
          .expect(404);
      });
    });
  });

  describe('Campaigns API', () => {
    describe('GET /api/campaigns', () => {
      it('should return all campaigns', async () => {
        mockStorage.seedData({ campaigns: SAMPLE_CAMPAIGNS });

        const response = await request(app)
          .get('/api/campaigns')
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          status: expect.any(String)
        });
      });

      it('should filter campaigns by status', async () => {
        mockStorage.seedData({ campaigns: SAMPLE_CAMPAIGNS });

        const response = await request(app)
          .get('/api/campaigns?status=active')
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].status).toBe('active');
      });
    });

    describe('POST /api/campaigns', () => {
      it('should create a new campaign', async () => {
        const campaignData = {
          name: 'Test Campaign',
          context: 'Test context',
          targetAudience: 'Test audience',
          numberOfTemplates: 3,
          daysBetweenMessages: 2
        };

        const response = await request(app)
          .post('/api/campaigns')
          .send(campaignData)
          .expect(201);

        expect(response.body).toMatchObject({
          id: expect.any(String),
          name: 'Test Campaign',
          context: 'Test context',
          status: 'draft'
        });
      });

      it('should validate required campaign fields', async () => {
        const invalidData = {
          name: 'Test Campaign',
          // missing context
        };

        const response = await request(app)
          .post('/api/campaigns')
          .send(invalidData)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.stringContaining('context')
        });
      });
    });

    describe('POST /api/campaigns/:id/execute', () => {
      it('should execute a campaign', async () => {
        const campaign = TestDataFactory.createMockCampaign({ status: 'active' });
        const leads = [TestDataFactory.createMockLead(), TestDataFactory.createMockLead()];
        
        mockStorage.seedData({ campaigns: [campaign], leads });

        const response = await request(app)
          .post(`/api/campaigns/${campaign.id}/execute`)
          .send({ testMode: true })
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          message: expect.stringContaining('executed'),
          emailsSent: expect.any(Number),
          totalLeads: expect.any(Number)
        });
      });

      it('should reject execution of inactive campaigns', async () => {
        const campaign = TestDataFactory.createMockCampaign({ status: 'draft' });
        mockStorage.seedData({ campaigns: [campaign] });

        const response = await request(app)
          .post(`/api/campaigns/${campaign.id}/execute`)
          .expect(400);

        expect(response.body).toMatchObject({
          error: expect.stringContaining('not active')
        });
      });
    });
  });

  describe('Lead Import API', () => {
    describe('POST /api/leads/analyze-csv', () => {
      it('should analyze CSV file and return headers', async () => {
        const response = await request(app)
          .post('/api/leads/analyze-csv')
          .attach('file', Buffer.from(VALID_CSV_CONTENT), 'test.csv')
          .expect(200);

        expect(response.body).toMatchObject({
          headers: ['firstName', 'lastName', 'email', 'phone', 'vehicleInterest'],
          previewRows: expect.any(Array),
          suggestedMappings: expect.any(Array),
          totalRows: 5
        });

        expect(response.body.suggestedMappings).toContainEqual({
          csvColumn: 'firstName',
          leadField: 'firstName'
        });
      });

      it('should reject non-CSV files', async () => {
        const response = await request(app)
          .post('/api/leads/analyze-csv')
          .attach('file', Buffer.from('not a csv'), 'test.txt')
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('CSV')
          })
        });
      });
    });

    describe('POST /api/leads/import-csv', () => {
      it('should import leads from CSV with mappings', async () => {
        const mappings = [
          { csvColumn: 'firstName', leadField: 'firstName' },
          { csvColumn: 'lastName', leadField: 'lastName' },
          { csvColumn: 'email', leadField: 'email' },
          { csvColumn: 'phone', leadField: 'phone' },
          { csvColumn: 'vehicleInterest', leadField: 'vehicleInterest' }
        ];

        const response = await request(app)
          .post('/api/leads/import-csv')
          .attach('file', Buffer.from(VALID_CSV_CONTENT), 'test.csv')
          .field('mappings', JSON.stringify(mappings))
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          total: 5,
          successful: 5,
          failed: 0
        });

        // Verify leads were created
        const leads = await mockStorage.getLeads();
        expect(leads).toHaveLength(5);
      });

      it('should require field mappings', async () => {
        const response = await request(app)
          .post('/api/leads/import-csv')
          .attach('file', Buffer.from(VALID_CSV_CONTENT), 'test.csv')
          .field('mappings', '[]')
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: 'NO_MAPPINGS'
          })
        });
      });
    });

    describe('GET /api/leads/export-csv', () => {
      it('should export leads to CSV format', async () => {
        const leads = [
          TestDataFactory.createMockLead({ firstName: 'John', email: 'john@example.com' }),
          TestDataFactory.createMockLead({ firstName: 'Jane', email: 'jane@example.com' })
        ];
        mockStorage.seedData({ leads });

        const response = await request(app)
          .get('/api/leads/export-csv')
          .expect(200);

        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain('attachment');
        expect(response.text).toContain('john@example.com');
        expect(response.text).toContain('jane@example.com');
      });

      it('should filter exported leads by campaign', async () => {
        const leads = [
          TestDataFactory.createMockLead({ email: 'campaign1@example.com', campaignId: 'campaign-1' }),
          TestDataFactory.createMockLead({ email: 'campaign2@example.com', campaignId: 'campaign-2' })
        ];
        mockStorage.seedData({ leads });

        const response = await request(app)
          .get('/api/leads/export-csv?campaignId=campaign-1')
          .expect(200);

        expect(response.text).toContain('campaign1@example.com');
        expect(response.text).not.toContain('campaign2@example.com');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('not found')
      });
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/leads')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('JSON')
      });
    });

    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      jest.spyOn(mockStorage, 'getLeads').mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/leads')
        .expect(500);

      expect(response.body).toMatchObject({
        error: expect.stringContaining('internal server error')
      });
    });
  });

  describe('Authentication & Authorization', () => {
    // Note: Add these tests when authentication is implemented
    it.skip('should require authentication for protected routes', async () => {
      await request(app)
        .post('/api/campaigns')
        .send({ name: 'Test' })
        .expect(401);
    });

    it.skip('should check user permissions for admin routes', async () => {
      // Mock user session with non-admin role
      await request(app)
        .delete('/api/campaigns/test-id')
        .expect(403);
    });
  });

  describe('Handover Evaluation API', () => {
    it('should evaluate using conversation when available', async () => {
      const lead = TestDataFactory.createMockLead();
      const conversation = TestDataFactory.createMockConversation({
        leadId: lead.id,
        messages: [
          { content: 'I would like to schedule a test drive for the SUV.', createdAt: new Date() }
        ]
      });
      mockStorage.seedData({ leads: [lead], conversations: [conversation] });

      const res = await request(app)
        .get(`/api/handover/evaluate?leadId=${lead.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        leadId: lead.id,
        mode: 'conversation',
        score: expect.any(Number),
        reason: expect.any(String)
      });
    });

    it('should fallback to lead-only evaluation when no conversation exists', async () => {
      const lead = TestDataFactory.createMockLead();
      mockStorage.seedData({ leads: [lead] });

      const res = await request(app)
        .get(`/api/handover/evaluate?leadId=${lead.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        leadId: lead.id,
        mode: 'lead-only',
        reason: 'insufficient_conversation',
      });
      expect(res.body.score).toBeGreaterThanOrEqual(0);
      expect(res.body.lead).toMatchObject({ status: lead.status });
    });

    it('should return 400 for missing leadId', async () => {
      const res = await request(app)
        .get('/api/handover/evaluate')
        .expect(400);

      expect(res.body).toMatchObject({
        error: 'MISSING_LEAD_ID',
        message: 'leadId query parameter is required'
      });
    });

    it('should return 400 for empty leadId', async () => {
      const res = await request(app)
        .get('/api/handover/evaluate?leadId=')
        .expect(400);

      expect(res.body).toMatchObject({
        error: 'INVALID_LEAD_ID',
        message: 'leadId must be a non-empty string'
      });
    });

    it('should return 404 for non-existent lead', async () => {
      const res = await request(app)
        .get('/api/handover/evaluate?leadId=non-existent-lead')
        .expect(404);

      expect(res.body).toMatchObject({
        error: 'LEAD_NOT_FOUND',
        message: 'Lead not found',
        leadId: 'non-existent-lead'
      });
    });
  });

  describe('Rate Limiting', () => {
    it.skip('should enforce rate limits on API endpoints', async () => {
      // Make multiple rapid requests
      const promises = Array.from({ length: 100 }, () =>
        request(app).get('/api/leads')
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});