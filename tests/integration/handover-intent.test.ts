import request from 'supertest';
import { makeApp } from '../e2e/appFactory';

describe('Intent-based handover', () => {
  let app: any, campaignId: string, leadId: string;

  beforeAll(async () => {
    app = await makeApp();
    // seed a campaign with criteria ["pricing","test_drive"] and a lead with a short transcript
    ({ campaignId, leadId } = await seedCampaignWithCriteria(['pricing','test_drive']));
    await seedLeadMessage(leadId, 'What is the monthly payment on this SUV?'); // pricing intent
  });

  it('triggers handover for pricing intent', async () => {
    const res = await request(app)
      .post('/api/handover/intent-evaluate')
      .send({ campaignId, leadId })
      .expect(200);
    expect(res.body.triggered).toBe(true);
    expect(res.body.intents).toContain('pricing');
  });

  it('requires leadId and campaignId', async () => {
    await request(app)
      .post('/api/handover/intent-evaluate')
      .send({})
      .expect(400);
  });

  it('returns false for non-matching intents', async () => {
    // Create a campaign with different criteria
    const { campaignId: testCampaignId, leadId: testLeadId } = await seedCampaignWithCriteria(['appointment']);
    await seedLeadMessage(testLeadId, 'Tell me about this vehicle specs'); // vehicle_info intent
    
    const res = await request(app)
      .post('/api/handover/intent-evaluate')
      .send({ campaignId: testCampaignId, leadId: testLeadId })
      .expect(200);
    
    expect(res.body.triggered).toBe(false);
    expect(res.body.intents).not.toContain('appointment');
  });
});

// Helper functions for seeding test data
async function seedCampaignWithCriteria(intents: string[]): Promise<{ campaignId: string; leadId: string }> {
  // Mock implementation - replace with actual seeding logic
  const campaignId = 'test-campaign-id';
  const leadId = 'test-lead-id';
  
  // In real implementation, this would:
  // 1. Create a campaign with handoverCriteria set to the provided intents
  // 2. Create a lead associated with the campaign
  // 3. Return the IDs
  
  return { campaignId, leadId };
}

async function seedLeadMessage(leadId: string, message: string): Promise<void> {
  // Mock implementation - replace with actual message seeding
  // In real implementation, this would:
  // 1. Create a conversation message from the lead
  // 2. Set isFromAI to false
  // 3. Associate with the leadId
}