/**
 * V2 Campaigns API Routes
 * 
 * Handles campaign creation and management with handover configuration.
 */

import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { dbV2, v2schema } from '../db.js';
import { insertCampaignSchema } from '../schema/index.js';
import { runCampaignSequences } from '../jobs/campaign-runner.js';

const router = Router();

// ============================================================================
// GET ALL CAMPAIGNS
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const campaigns = await dbV2
      .select()
      .from(v2schema.campaigns)
      .orderBy(v2schema.campaigns.createdAt);

    res.json({
      success: true,
      campaigns: campaigns.map(campaign => ({
        ...campaign,
        // Convert snake_case to camelCase for API response
        handoverMode: campaign.handoverMode,
        handoverKeywords: campaign.handoverKeywords,
        handoverNote: campaign.handoverNote,
      }))
    });
  } catch (error) {
    console.error('Error fetching V2 campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
});

// ============================================================================
// CREATE CAMPAIGN
// ============================================================================

router.post('/', async (req, res) => {
  try {
    // Validate request body
    const validatedData = insertCampaignSchema.parse(req.body);
    
    // Insert campaign
    const [campaign] = await dbV2
      .insert(v2schema.campaigns)
      .values({
        ...validatedData,
        // Convert camelCase to snake_case for database
        handoverMode: validatedData.handoverMode,
        handoverKeywords: validatedData.handoverKeywords,
        handoverNote: validatedData.handoverNote,
      })
      .returning();

    res.status(201).json({
      success: true,
      campaign: {
        ...campaign,
        // Convert snake_case back to camelCase for API response
        handoverMode: campaign.handoverMode,
        handoverKeywords: campaign.handoverKeywords,
        handoverNote: campaign.handoverNote,
      }
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign'
    });
  }
});

// ============================================================================
// GET CAMPAIGN
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [campaign] = await dbV2
      .select()
      .from(v2schema.campaigns)
      .where(eq(v2schema.campaigns.id, id));
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    res.json({
      success: true,
      campaign: {
        ...campaign,
        // Convert snake_case to camelCase for API response
        handoverMode: campaign.handoverMode,
        handoverKeywords: campaign.handoverKeywords,
        handoverNote: campaign.handoverNote,
      }
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign'
    });
  }
});

// ============================================================================
// UPDATE CAMPAIGN
// ============================================================================

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate partial update data
    const validatedData = insertCampaignSchema.partial().parse(req.body);
    
    const [updatedCampaign] = await dbV2
      .update(v2schema.campaigns)
      .set({
        ...validatedData,
        handoverMode: validatedData.handoverMode,
        handoverKeywords: validatedData.handoverKeywords,
        handoverNote: validatedData.handoverNote,
        updatedAt: new Date(),
      })
      .where(eq(v2schema.campaigns.id, id))
      .returning();
    
    if (!updatedCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    res.json({
      success: true,
      campaign: {
        ...updatedCampaign,
        handoverMode: updatedCampaign.handoverMode,
        handoverKeywords: updatedCampaign.handoverKeywords,
        handoverNote: updatedCampaign.handoverNote,
      }
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update campaign'
    });
  }
});

export default router;

// ============================================================================
// SEQUENCE MANAGEMENT (minimal)
// ============================================================================

// Get sequence
router.get('/:id/sequence', async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await dbV2
      .select({ sequence: v2schema.campaigns.sequence })
      .from(v2schema.campaigns)
      .where(eq(v2schema.campaigns.id, id));
    if (!row) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true, sequence: row.sequence || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch sequence' });
  }
});

// Set sequence
router.post('/:id/sequence', async (req, res) => {
  try {
    const { id } = req.params;
    const sequence = Array.isArray(req.body?.sequence) ? req.body.sequence : [];
    const [row] = await dbV2
      .update(v2schema.campaigns)
      .set({ sequence, updatedAt: new Date() })
      .where(eq(v2schema.campaigns.id, id))
      .returning({ id: v2schema.campaigns.id });
    if (!row) return res.status(404).json({ success: false, error: 'Campaign not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update sequence' });
  }
});

// Execute due sends for a campaign now
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    // Validate exists and active
    const [camp] = await dbV2
      .select({ id: v2schema.campaigns.id })
      .from(v2schema.campaigns)
      .where(and(eq(v2schema.campaigns.id, id), eq(v2schema.campaigns.status, 'active')));
    if (!camp) return res.status(404).json({ success: false, error: 'Active campaign not found' });

    console.log(`🚀 Executing campaign ${id} via API trigger`);
    await runCampaignSequences([id]);
    res.json({ success: true, message: `Campaign ${id} execution triggered` });
  } catch (e) {
    console.error(`❌ Campaign ${id} execution failed:`, e);
    res.status(500).json({ success: false, error: 'Failed to execute campaign sequence' });
  }
});

// Execute ALL active campaigns
router.post('/execute-all', async (req, res) => {
  try {
    console.log('🚀 Executing ALL active campaigns via API trigger');
    await runCampaignSequences(); // No campaign IDs = all active campaigns
    res.json({ success: true, message: 'All active campaigns execution triggered' });
  } catch (e) {
    console.error('❌ Execute all campaigns failed:', e);
    res.status(500).json({ success: false, error: 'Failed to execute all campaigns' });
  }
});
