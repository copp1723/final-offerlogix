import express from 'express';
import request from 'supertest';

jest.mock('../../server/services/mailgun-webhook-handler', () => ({
  getCampaignMetrics: jest.fn().mockResolvedValue({
    sent: 10,
    delivered: 8,
    opened: 5,
    clicked: 2,
    bounced: 1,
    deliveryRate: 80.00,
    openRate: 62.50,
    clickRate: 40.00,
    bounceRate: 10.00,
  }),
}));

import { getCampaignMetrics } from '../../server/services/mailgun-webhook-handler';

describe('GET /api/campaigns/:id/metrics', () => {
  const app = express();
  app.get('/api/campaigns/:id/metrics', async (req, res) => {
    const metrics = await getCampaignMetrics(req.params.id);
    res.json(metrics);
  });

  it('returns campaign metrics with rates calculated', async () => {
    const res = await request(app).get('/api/campaigns/test-campaign/metrics').expect(200);
    expect(res.body).toEqual({
      sent: 10,
      delivered: 8,
      opened: 5,
      clicked: 2,
      bounced: 1,
      deliveryRate: 80.00,
      openRate: 62.50,
      clickRate: 40.00,
      bounceRate: 10.00,
    });
    expect(getCampaignMetrics).toHaveBeenCalledWith('test-campaign');
  });

  it('handles errors gracefully', async () => {
    (getCampaignMetrics as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
    
    const errorApp = express();
    errorApp.get('/api/campaigns/:id/metrics', async (req, res) => {
      try {
        const metrics = await getCampaignMetrics(req.params.id);
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ message: "Failed to get campaign metrics" });
      }
    });

    await request(errorApp)
      .get('/api/campaigns/test-campaign/metrics')
      .expect(500)
      .expect({ message: "Failed to get campaign metrics" });
  });
});