import express from 'express';
import request from 'supertest';
import { selectTemplateVersion } from '../../server/services/template-versioning';

// Mock the template versioning service
jest.mock('../../server/services/template-versioning', () => ({
  selectTemplateVersion: jest.fn(),
}));

// Mock the reliable email service
jest.mock('../../server/services/reliable-email-service', () => ({
  sendBulkEmails: jest.fn(),
}));

import { sendBulkEmails } from '../../server/services/reliable-email-service';

describe('Campaign Template Versioning Integration', () => {
  const mockSelectTemplateVersion = selectTemplateVersion as jest.MockedFunction<typeof selectTemplateVersion>;
  const mockSendBulkEmails = sendBulkEmails as jest.MockedFunction<typeof sendBulkEmails>;

  const app = express();
  app.use(express.json());

  // Simplified version of the actual endpoint for testing
  app.post('/api/campaigns/:id/send-followup', async (req, res) => {
    const { templateIndex = 1, leadIds = [] } = req.body;
    const campaignId = req.params.id;
    
    // Mock campaign and template data
    const campaign = { id: campaignId, name: 'Test Campaign' };
    const templates = [
      {
        subject: 'Template 1',
        content: 'Content 1',
        versions: {
          A: { subject: 'Subject A', content: 'Content A' },
          B: { subject: 'Subject B', content: 'Content B' }
        },
        ab: { A: 50, B: 50 }
      }
    ];
    
    // Mock leads
    const targetLeads = [
      { id: 'lead-1', email: 'test1@example.com' },
      { id: 'lead-2', email: 'test2@example.com' },
      { id: 'lead-3', email: 'test3@example.com' }
    ];

    const template = templates[templateIndex - 1];
    const variantCounts: Record<string, number> = {};
    
    const emails = targetLeads.map((lead: any) => {
      const { versionKey, template: chosen } = mockSelectTemplateVersion(template, lead.id);
      variantCounts[versionKey] = (variantCounts[versionKey] || 0) + 1;
      return {
        to: lead.email,
        subject: chosen.subject || `${campaign.name} - Follow-up`,
        content: chosen.content || 'Follow-up email content',
        campaignId,
        leadId: lead.id,
        metadata: { templateVersion: versionKey }
      };
    });

    const results = await mockSendBulkEmails(emails);

    res.json({
      message: "Follow-up emails queued",
      successful: results.queued,
      failed: results.failed,
      suppressed: results.suppressed,
      errors: results.errors,
      variants: variantCounts
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should distribute leads across A/B variants', async () => {
    // Mock template version selection to return alternating A/B variants
    mockSelectTemplateVersion
      .mockReturnValueOnce({
        versionKey: 'A',
        template: { subject: 'Subject A', content: 'Content A' },
        bucketAssignment: 25
      })
      .mockReturnValueOnce({
        versionKey: 'B',
        template: { subject: 'Subject B', content: 'Content B' },
        bucketAssignment: 75
      })
      .mockReturnValueOnce({
        versionKey: 'A',
        template: { subject: 'Subject A', content: 'Content A' },
        bucketAssignment: 10
      });

    mockSendBulkEmails.mockResolvedValue({
      success: true,
      queued: 3,
      failed: 0,
      suppressed: 0,
      errors: []
    });

    const response = await request(app)
      .post('/api/campaigns/test-campaign/send-followup')
      .send({ templateIndex: 1 })
      .expect(200);

    // Verify that selectTemplateVersion was called for each lead
    expect(mockSelectTemplateVersion).toHaveBeenCalledTimes(3);
    expect(mockSelectTemplateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        versions: expect.objectContaining({
          A: { subject: 'Subject A', content: 'Content A' },
          B: { subject: 'Subject B', content: 'Content B' }
        }),
        ab: { A: 50, B: 50 }
      }),
      expect.stringMatching(/^lead-\d+$/)
    );

    // Verify response includes variant counts
    expect(response.body.variants).toEqual({ A: 2, B: 1 });
    expect(response.body.successful).toBe(3);

    // Verify emails were sent with correct template versions
    const sentEmails = mockSendBulkEmails.mock.calls[0][0];
    expect(sentEmails).toHaveLength(3);
    
    expect(sentEmails[0]).toMatchObject({
      to: 'test1@example.com',
      subject: 'Subject A',
      content: 'Content A',
      metadata: { templateVersion: 'A' }
    });
    
    expect(sentEmails[1]).toMatchObject({
      to: 'test2@example.com',
      subject: 'Subject B',
      content: 'Content B',
      metadata: { templateVersion: 'B' }
    });
  });

  it('should handle template versioning errors gracefully', async () => {
    // Mock template version selection to throw an error
    mockSelectTemplateVersion.mockImplementation(() => {
      throw new Error('Template versioning error');
    });

    await request(app)
      .post('/api/campaigns/test-campaign/send-followup')
      .send({ templateIndex: 1 })
      .expect(500);
  });

  it('should include metadata in email requests', async () => {
    mockSelectTemplateVersion.mockReturnValue({
      versionKey: 'A',
      template: { subject: 'Subject A', content: 'Content A' },
      bucketAssignment: 25
    });

    mockSendBulkEmails.mockResolvedValue({
      success: true,
      queued: 3,
      failed: 0,
      suppressed: 0,
      errors: []
    });

    await request(app)
      .post('/api/campaigns/test-campaign/send-followup')
      .send({ templateIndex: 1 })
      .expect(200);

    const sentEmails = mockSendBulkEmails.mock.calls[0][0];
    
    expect(sentEmails.every(email => 
      email.metadata && 
      email.metadata.templateVersion &&
      email.campaignId &&
      email.leadId
    )).toBe(true);
  });

  it('should handle legacy templates without versions', async () => {
    // Mock for legacy template (no versions, just subject/content)
    mockSelectTemplateVersion.mockReturnValue({
      versionKey: 'default',
      template: { subject: 'Legacy Subject', content: 'Legacy Content' },
      bucketAssignment: 0
    });

    mockSendBulkEmails.mockResolvedValue({
      success: true,
      queued: 3,
      failed: 0,
      suppressed: 0,
      errors: []
    });

    const response = await request(app)
      .post('/api/campaigns/test-campaign/send-followup')
      .send({ templateIndex: 1 })
      .expect(200);

    expect(response.body.variants).toEqual({ default: 3 });
    
    const sentEmails = mockSendBulkEmails.mock.calls[0][0];
    expect(sentEmails[0].subject).toBe('Legacy Subject');
    expect(sentEmails[0].content).toBe('Legacy Content');
  });

  it('should track variant distribution accurately', async () => {
    // Mock uneven distribution
    mockSelectTemplateVersion
      .mockReturnValueOnce({ versionKey: 'A', template: { subject: 'A', content: 'a' }, bucketAssignment: 10 })
      .mockReturnValueOnce({ versionKey: 'A', template: { subject: 'A', content: 'a' }, bucketAssignment: 20 })
      .mockReturnValueOnce({ versionKey: 'B', template: { subject: 'B', content: 'b' }, bucketAssignment: 80 });

    mockSendBulkEmails.mockResolvedValue({
      success: true,
      queued: 3,
      failed: 0,
      suppressed: 0,
      errors: []
    });

    const response = await request(app)
      .post('/api/campaigns/test-campaign/send-followup')
      .send({ templateIndex: 1 })
      .expect(200);

    expect(response.body.variants).toEqual({ A: 2, B: 1 });
    expect(response.body.message).toBe('Follow-up emails queued');
  });
});