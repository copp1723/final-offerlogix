import request from 'supertest';
import { makeApp, testDb, queue, saveArtifact } from './helpers';

describe('E2E: campaign happy path', () => {
  let app: any, campaignId: string;

  beforeAll(async () => {
    try {
      app = await makeApp();
      ({ campaignId } = await testDb.seedCampaignWithRecipients(2));
      console.log(`E2E test setup complete. Campaign ID: ${campaignId}`);
    } catch (error) {
      console.error('E2E setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    queue.clear();
  });

  it('generates template → previews → sends → accepts webhook', async () => {
    // Generate template
    const gen = await request(app)
      .post(`/api/campaigns/${campaignId}/templates/generate`)
      .expect(201);
    expect(gen.body?.subject).toBeTruthy();
    expect(gen.body?.version).toBeGreaterThanOrEqual(1);

    // Preview template (using update templates endpoint as proxy)
    const templateData = {
      templates: [{
        subject: gen.body.subject,
        content: gen.body.bodyHtml || '<p>Test content</p>',
        text: gen.body.bodyText || 'Test content'
      }],
      numberOfTemplates: 1,
      daysBetweenMessages: 1
    };
    
    const prev = await request(app)
      .put(`/api/campaigns/${campaignId}/templates`)
      .send(templateData)
      .expect(200);
    
    await saveArtifact('preview.html', templateData.templates[0].content);

    // Launch campaign (this will send emails)
    const launch = await request(app)
      .post(`/api/campaigns/${campaignId}/launch`)
      .expect(200);
    
    expect(launch.body?.message).toContain('Campaign launched');
    await saveArtifact('launch-log.json', JSON.stringify(launch.body, null, 2));

    // Simulate webhook for delivered email
    const payload = { 
      event: 'delivered', 
      timestamp: Math.floor(Date.now() / 1000),
      id: 'test-message-id',
      recipient: 'user0@example.com',
      'recipient-domain': 'example.com',
      message: {
        headers: {
          'message-id': 'test-message-id',
          to: 'user0@example.com',
          from: 'test@example.com',
          subject: gen.body.subject
        }
      }
    };

    const { headers, body } = testDb.mailgun.sign(payload);
    
    const webhookRes = await request(app)
      .post('/api/email-reliability/webhook/mailgun')
      .set(headers)
      .send(body)
      .expect(200);
    
    expect(webhookRes.body.received).toBe(true);

    // Verify campaign status
    const status = await testDb.getCampaignStatus(campaignId);
    expect(status).toBe('active'); // Campaign becomes active after launch
  });
});