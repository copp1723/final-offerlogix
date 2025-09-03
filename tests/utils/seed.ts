import { storage } from '../../server/storage';
import { randomUUID } from 'crypto';

// Seed a campaign with a given number of recipients
export async function seedCampaignWithRecipients(recipientCount = 2) {
  try {
    const campaign = await storage.createCampaign({
      name: 'E2E Test Campaign',
      context: 'End-to-end test campaign context for automotive leads',
      status: 'draft',
      targetAudience: 'test-audience',
      handoverGoals: 'test-goals',
      templates: [],
      subjectLines: [],
      numberOfTemplates: 1,
      daysBetweenMessages: 1
    } as any);

    const leads = Array.from({ length: recipientCount }, (_, i) => ({
      id: randomUUID(),
      email: `e2e-test-user${i}@example.com`,
      firstName: `TestUser${i}`,
      lastName: 'E2ETest',
      phone: `555-0${String(i).padStart(3, '0')}`,
      status: 'new' as const,
      campaignId: campaign.id,
    }));

    await storage.createLeads(leads as any);

    console.log(`Seeded campaign ${campaign.id} with ${leads.length} leads`);
    return { campaignId: campaign.id };
  } catch (error) {
    console.error('Failed to seed campaign:', error);
    throw error;
  }
}

export async function getCampaignStatus(id: string) {
  const campaign = await storage.getCampaign(id);
  return campaign?.status;
}