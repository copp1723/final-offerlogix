import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';
import { evaluateMessageForHandover } from '../services/intent-handover-service';
import { storage } from '../storage';

const router = Router();

const evaluateSchema = z.object({
  campaignId: z.string(),
  leadId: z.string(),
  message: z.string(),
});

router.post('/evaluate', validateRequest({ body: evaluateSchema }), async (req, res) => {
  try {
    const result = await evaluateMessageForHandover(req.body);
    res.json(result);
  } catch (error) {
    console.error('Failed to evaluate handover intent:', error);
    res.status(500).json({ error: 'Failed to evaluate handover' });
  }
});

const sendSchema = z.object({
  campaignId: z.string(),
  leadId: z.string(),
  intent: z.string(),
});

router.post('/send', validateRequest({ body: sendSchema }), async (req, res) => {
  try {
    const { campaignId, leadId, intent } = req.body;
    await storage.logHandoverEvent({ campaignId, leadId, intent, triggeredAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to send handover:', error);
    res.status(500).json({ error: 'Failed to send handover' });
  }
});

export default router;