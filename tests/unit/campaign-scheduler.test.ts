import { describe, it, expect, jest } from '@jest/globals';

jest.mock('../../server/db.js', () => {
  const update: any = jest.fn();
  update.mockReturnValue({
    set: jest.fn().mockReturnThis(),
    where: jest.fn(async () => undefined)
  });
  const select: any = jest.fn();
  select.mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn(async () => [])
    })
  });
  return { db: { update, select } };
}, { virtual: true });

jest.mock('@shared/schema', () => ({ campaigns: {} }));

describe('CampaignScheduler', () => {
  it('updates campaign when scheduling immediate execution', async () => {
    const { campaignScheduler } = await import('../../server/services/campaign-scheduler');
    const { db } = await import('../../server/db.js');
    const spy = jest.spyOn(campaignScheduler, 'executeCampaign').mockResolvedValue({ success: true, campaignId: '1' });

    await campaignScheduler.scheduleCampaign('1', { scheduleType: 'immediate' });

    expect(db.update).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('1');
    spy.mockRestore();
  });
});