jest.mock('../../server/storage');
jest.mock('../../server/db');
jest.mock('@shared/schema', () => ({
  handoverEvents: {},
  leadScores: {},
}));
jest.mock('../../server/services/intent-detector-simple', () => ({
  detectIntents: jest.fn().mockResolvedValue({
    intents: [{ intent: 'pricing_inquiry', confidence: 0.8 }]
  })
}));

import { evaluateMessageForHandover } from '../../server/services/intent-handover-service';
import { storage } from '../../server/storage';
import { db } from '../../server/db';

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockDb = {
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([])
    })
  })
};
(db as any) = mockDb;

describe('evaluateMessageForHandover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.insertLeadScore = jest.fn().mockResolvedValue(undefined);
  });

  it('returns high score and immediate action for urgent engaged message', async () => {
    const mockCampaign = {
      id: 'campaign1',
      handoverCriteria: ['pricing_inquiry'],
      leadScoreWeights: { urgency: 0.6, questions: 0.2, engagement: 0.1, timeline: 0.1 },
      handoverScoreThresholds: { immediate: 75, scheduled: 50 }
    };
    mockStorage.getCampaign.mockResolvedValue(mockCampaign as any);

    const result = await evaluateMessageForHandover({
      campaignId: 'campaign1',
      leadId: 'lead1',
      message: 'I need pricing information ASAP!'
    });

    expect(result.score).toBeGreaterThan(50);
    expect(result.action).toBe('immediate');
    expect(result.handoverTriggered).toBe(true);
    expect(mockStorage.insertLeadScore).toHaveBeenCalledWith({
      leadId: 'lead1',
      campaignId: 'campaign1',
      score: expect.any(Number)
    });
  });

  it('returns low score and no action for minimal engagement', async () => {
    const mockCampaign = {
      id: 'campaign1',
      handoverCriteria: ['pricing_inquiry'],
      handoverScoreThresholds: { immediate: 75, scheduled: 50 }
    };
    mockStorage.getCampaign.mockResolvedValue(mockCampaign as any);

    const result = await evaluateMessageForHandover({
      campaignId: 'campaign1',
      leadId: 'lead1',
      message: 'hi'
    });

    expect(result.score).toBeLessThan(50);
    expect(result.action).toBe('none');
    expect(result.handoverTriggered).toBe(false);
  });

  it('uses default thresholds when not configured', async () => {
    const mockCampaign = {
      id: 'campaign1',
      handoverCriteria: ['pricing_inquiry']
    };
    mockStorage.getCampaign.mockResolvedValue(mockCampaign as any);

    const result = await evaluateMessageForHandover({
      campaignId: 'campaign1',
      leadId: 'lead1',
      message: 'What is the price? I need this urgent!'
    });

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('action');
    expect(['immediate', 'scheduled', 'none']).toContain(result.action);
  });

  it('handles missing campaign gracefully', async () => {
    mockStorage.getCampaign.mockResolvedValue(undefined);

    const result = await evaluateMessageForHandover({
      campaignId: 'nonexistent',
      leadId: 'lead1',
      message: 'test message'
    });

    expect(result.action).toBe('none');
    expect(result.handoverTriggered).toBe(false);
  });

  it('respects custom weights from campaign', async () => {
    const mockCampaign = {
      id: 'campaign1',
      handoverCriteria: ['pricing_inquiry'],
      leadScoreWeights: { questions: 0.8, urgency: 0.1, engagement: 0.05, timeline: 0.05 },
      handoverScoreThresholds: { immediate: 60, scheduled: 30 }
    };
    mockStorage.getCampaign.mockResolvedValue(mockCampaign as any);

    const result = await evaluateMessageForHandover({
      campaignId: 'campaign1',
      leadId: 'lead1',
      message: 'What is the price? How much for financing? When can I get it?'
    });

    // Should score highly due to multiple questions and high question weight
    expect(result.score).toBeGreaterThan(30);
    expect(['immediate', 'scheduled']).toContain(result.action);
  });
});