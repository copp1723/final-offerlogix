import { getCampaignMetrics, type CampaignMetrics } from '../../server/services/mailgun-webhook-handler';
import { db } from '../../server/db';

// Mock the database
jest.mock('../../server/db', () => ({
  db: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
        })),
      })),
    })),
  }
}));

// Mock logger
jest.mock('../../server/logging/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

describe('getCampaignMetrics', () => {
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate metrics correctly with valid data', async () => {
    // Mock database responses
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ count: 100 }]), // 100 sent emails
      }),
    } as any);

    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{
          delivered: 85,
          opened: 40,
          clicked: 12,
          bounced: 5,
        }]),
      }),
    } as any);

    const result = await getCampaignMetrics('test-campaign-id');

    const expected: CampaignMetrics = {
      sent: 100,
      delivered: 85,
      opened: 40,
      clicked: 12,
      bounced: 5,
      deliveryRate: 85.00, // 85/100 * 100
      openRate: 47.06, // 40/85 * 100
      clickRate: 30.00, // 12/40 * 100
      bounceRate: 5.00, // 5/100 * 100
    };

    expect(result).toEqual(expected);
  });

  it('should handle zero values gracefully', async () => {
    // Mock database responses with no data
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ count: 0 }]),
      }),
    } as any);

    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
        }]),
      }),
    } as any);

    const result = await getCampaignMetrics('empty-campaign-id');

    const expected: CampaignMetrics = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    };

    expect(result).toEqual(expected);
  });

  it('should handle database errors gracefully', async () => {
    mockDb.select.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const result = await getCampaignMetrics('error-campaign-id');

    const expected: CampaignMetrics = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      deliveryRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
    };

    expect(result).toEqual(expected);
  });

  it('should calculate rates correctly for edge cases', async () => {
    // Mock database responses: 50 sent, 0 delivered
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{ count: 50 }]),
      }),
    } as any);

    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([{
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 10,
        }]),
      }),
    } as any);

    const result = await getCampaignMetrics('edge-case-campaign-id');

    expect(result.deliveryRate).toBe(0); // 0/50 * 100
    expect(result.openRate).toBe(0); // No delivered emails, so can't open
    expect(result.clickRate).toBe(0); // No opened emails, so can't click
    expect(result.bounceRate).toBe(20); // 10/50 * 100
  });
});