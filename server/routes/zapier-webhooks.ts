import { Router } from 'express';
import { db } from '../db.js';
import { leads, handoverEvents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

/**
 * Zapier Webhook Integration for OfferLogix
 * Sends sales-qualified leads (handovers) to HubSpot via Zapier
 */

// Helper to generate webhook signature for security
function generateWebhookSignature(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

// Helper to verify incoming webhook signatures (for callbacks)
function verifyWebhookSignature(payload: any, signature: string, secret: string): boolean {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * POST /api/zapier/send-handover
 * Sends a handover/sales brief to Zapier for HubSpot integration
 * Protected route - requires authentication
 */
router.post('/send-handover', authenticateToken, async (req, res) => {
  try {
    const { handoverId } = req.body;
    
    if (!handoverId) {
      return res.status(400).json({
        success: false,
        error: 'Handover ID is required'
      });
    }

    // Fetch the handover event data
    const [handover] = await db
      .select()
      .from(handoverEvents)
      .where(eq(handoverEvents.id, handoverId))
      .limit(1);

    if (!handover) {
      return res.status(404).json({
        success: false,
        error: 'Handover not found'
      });
    }

    // Fetch the associated lead data
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, handover.leadId))
      .limit(1);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Associated lead not found'
      });
    }

    // Prepare the payload for Zapier
    const zapierPayload = {
      // Lead Information
      email: lead.email,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      phone: lead.phone || '',
      
      // Company Information (B2B context)
      companyName: lead.companyName || `${lead.firstName} ${lead.lastName}`.trim(),
      dealershipType: lead.dealershipType || 'independent',
      decisionMakerRole: lead.decisionMakerRole || 'owner',
      annualVolume: lead.annualVolume || 0,
      currentFinanceProvider: lead.currentFinanceProvider || 'unknown',
      
      // Product Interest (what we're selling to them)
      productInterest: lead.productInterest || 'Instant Credit Platform',
      
      // Lead Scoring & Qualification
      leadScore: 75, // Default score since handoverEvents doesn't have scoring
      qualificationScore: 80,
      urgencyScore: 70,
      
      // Handover Information
      handoverId: handover.id,
      handoverIntent: handover.intent || 'unknown',
      handoverDate: handover.triggeredAt || new Date(),
      handoverReason: 'Qualified for sales engagement',
      
      // Metadata
      source: 'OfferLogix Platform',
      createdAt: new Date().toISOString(),
      campaignId: lead.campaignId || null,
      
      // Custom fields for HubSpot
      customFields: {
        offerlogix_lead_id: lead.id,
        offerlogix_handover_id: handover.id,
        offerlogix_sync_date: new Date().toISOString(),
        lead_temperature: handover.score > 80 ? 'hot' : handover.score > 60 ? 'warm' : 'cold'
      }
    };

    // Get Zapier webhook URL from environment
    const ZAPIER_WEBHOOK_URL = process.env.ZAPIER_WEBHOOK_URL;
    
    if (!ZAPIER_WEBHOOK_URL) {
      console.error('ZAPIER_WEBHOOK_URL not configured');
      return res.status(500).json({
        success: false,
        error: 'Zapier integration not configured. Please contact support.'
      });
    }

    // Send to Zapier
    const zapierResponse = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OfferLogix-Source': 'handover-sync',
        'X-OfferLogix-Timestamp': new Date().toISOString()
      },
      body: JSON.stringify(zapierPayload)
    });

    if (!zapierResponse.ok) {
      throw new Error(`Zapier webhook failed: ${zapierResponse.status}`);
    }

    // Update the handover to mark it as synced
    await db
      .update(handoverEvents)
      .set({
        syncedToHubspot: true,
        hubspotSyncDate: new Date(),
        hubspotSyncStatus: 'success'
      })
      .where(eq(handoverEvents.id, handoverId));

    // Log the sync event
    console.log(`[Zapier Sync] Successfully sent handover ${handoverId} to Zapier`);

    res.json({
      success: true,
      message: 'Handover sent to HubSpot via Zapier',
      data: {
        handoverId,
        leadId: lead.id,
        syncedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Zapier webhook error:', error);
    
    // Mark sync as failed
    if (req.body.handoverId) {
      await db
        .update(handoverEvents)
        .set({
          hubspotSyncStatus: 'failed',
          hubspotSyncError: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(handoverEvents.id, req.body.handoverId));
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send handover to Zapier',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/zapier/webhook-callback
 * Receives confirmation from Zapier after HubSpot contact/deal creation
 */
router.post('/webhook-callback', async (req, res) => {
  try {
    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.ZAPIER_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-zapier-signature'] as string;
      if (!signature || !verifyWebhookSignature(req.body, signature, webhookSecret)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature'
        });
      }
    }

    const {
      handoverId,
      leadId,
      hubspotContactId,
      hubspotDealId,
      status,
      error
    } = req.body;

    if (status === 'success') {
      // Update the handover event with HubSpot IDs
      await db
        .update(handoverEvents)
        .set({
          hubspotContactId,
          hubspotDealId,
          hubspotSyncStatus: 'completed',
          hubspotSyncDate: new Date()
        })
        .where(eq(handoverEvents.id, handoverId));

      // Also update the lead with HubSpot contact ID
      if (leadId) {
        await db
          .update(leads)
          .set({
            hubspotContactId,
            status: 'customer' // Mark as customer since they're in HubSpot now
          })
          .where(eq(leads.id, leadId));
      }

      console.log(`[Zapier Callback] HubSpot sync completed for handover ${handoverId}`);
    } else {
      // Handle sync failure
      await db
        .update(handoverEvents)
        .set({
          hubspotSyncStatus: 'failed',
          hubspotSyncError: error || 'Unknown error from Zapier'
        })
        .where(eq(handoverEvents.id, handoverId));

      console.error(`[Zapier Callback] HubSpot sync failed for handover ${handoverId}:`, error);
    }

    res.json({ success: true, received: true });

  } catch (error) {
    console.error('Zapier callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Zapier callback'
    });
  }
});

/**
 * GET /api/zapier/sync-status/:handoverId
 * Check the sync status of a handover
 * Protected route - requires authentication
 */
router.get('/sync-status/:handoverId', authenticateToken, async (req, res) => {
  try {
    const { handoverId } = req.params;

    const [handover] = await db
      .select({
        id: handoverEvents.id,
        syncedToHubspot: handoverEvents.syncedToHubspot,
        hubspotSyncStatus: handoverEvents.hubspotSyncStatus,
        hubspotSyncDate: handoverEvents.hubspotSyncDate,
        hubspotContactId: handoverEvents.hubspotContactId,
        hubspotDealId: handoverEvents.hubspotDealId,
        hubspotSyncError: handoverEvents.hubspotSyncError
      })
      .from(handoverEvents)
      .where(eq(handoverEvents.id, handoverId))
      .limit(1);

    if (!handover) {
      return res.status(404).json({
        success: false,
        error: 'Handover not found'
      });
    }

    res.json({
      success: true,
      data: handover
    });

  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync status'
    });
  }
});

export default router;