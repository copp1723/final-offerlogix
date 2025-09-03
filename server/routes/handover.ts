import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { IntentHandoverService } from '../services/handover/handover-service';
import { detectIntent, detectIntentFromConversation } from '../services/intent-detector';
import logger from '../logging/logger';

const router = Router();

/**
 * GET /api/handover/events/:leadId
 * Get handover events for a specific lead
 */
router.get('/events/:leadId', async (req: Request, res: Response) => {
  try {
    const { leadId } = req.params;
    const { campaignId } = req.query;
    
    const events = await storage.getHandoverEvents(
      leadId, 
      campaignId as string | undefined
    );
    
    res.json({ events });
  } catch (error) {
    logger.error('Failed to get handover events', { 
      leadId: req.params.leadId, 
      error 
    });
    res.status(500).json({ error: 'Failed to get handover events' });
  }
});

/**
 * POST /api/handover/trigger
 * Manually trigger handover evaluation for a lead
 */
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { leadId, campaignId } = req.body;
    
    if (!leadId || !campaignId) {
      return res.status(400).json({ error: 'leadId and campaignId are required' });
    }
    
    await IntentHandoverService.maybeTriggerIntentHandover({ leadId, campaignId });
    
    res.json({ message: 'Handover evaluation triggered' });
  } catch (error) {
    logger.error('Failed to trigger handover', { 
      leadId: req.body.leadId, 
      campaignId: req.body.campaignId,
      error 
    });
    res.status(500).json({ error: 'Failed to trigger handover evaluation' });
  }
});

/**
 * POST /api/handover/detect-intent
 * Analyze message content for intent detection (testing/debugging endpoint)
 */
router.post('/detect-intent', async (req: Request, res: Response) => {
  try {
    const { message, messages } = req.body;
    
    if (!message && !messages) {
      return res.status(400).json({ error: 'message or messages array is required' });
    }
    
    const intent = messages
      ? await detectIntentFromConversation(messages)
      : await detectIntent(message);
    
    res.json({ 
      intent,
      message: message || 'multiple messages',
      analysis: `Detected intent: ${intent}`
    });
  } catch (error) {
    logger.error('Intent detection failed', { 
      error 
    });
    res.status(500).json({ error: 'Intent detection failed' });
  }
});

/**
 * GET /api/handover/campaign/:campaignId/criteria
 * Get handover criteria for a campaign
 */
router.get('/campaign/:campaignId/criteria', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = await storage.getCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json({
      campaignId,
      handoverCriteria: campaign.handoverCriteria,
      handoverRecipient: campaign.handoverRecipient
    });
  } catch (error) {
    logger.error('Failed to get campaign handover criteria', { 
      campaignId: req.params.campaignId,
      error 
    });
    res.status(500).json({ error: 'Failed to get campaign criteria' });
  }
});

/**
 * PUT /api/handover/campaign/:campaignId/criteria
 * Update handover criteria for a campaign
 */
router.put('/campaign/:campaignId/criteria', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { handoverCriteria, handoverRecipient } = req.body;
    
    // Validate criteria format if provided
    if (handoverCriteria) {
      try {
        const parsed = typeof handoverCriteria === 'string' 
          ? JSON.parse(handoverCriteria) 
          : handoverCriteria;
        
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.intents)) {
          return res.status(400).json({ 
            error: 'Invalid handoverCriteria format. Expected: { intents: string[], threshold?: number }' 
          });
        }
      } catch {
        return res.status(400).json({ error: 'Invalid JSON in handoverCriteria' });
      }
    }
    
    await storage.updateCampaign(campaignId, {
      handoverCriteria,
      handoverRecipient
    });
    
    res.json({ message: 'Campaign handover criteria updated successfully' });
  } catch (error) {
    logger.error('Failed to update campaign handover criteria', { 
      campaignId: req.params.campaignId,
      error 
    });
    res.status(500).json({ error: 'Failed to update campaign criteria' });
  }
});

export default router;