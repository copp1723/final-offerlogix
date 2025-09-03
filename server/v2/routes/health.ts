import { Router } from 'express';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { dbV2, v2schema } from '../db.js';
import { v2CampaignScheduler } from '../../services/v2-campaign-scheduler.js';

const router = Router();

// GET /v2/health/domains
// Returns:
// - allowedDomains: from MAILGUN_ALLOWED_DOMAINS
// - agentDomainsInActiveCampaigns: distinct agent domains used by active campaigns
// - missingInAllowlist: agent domains not present in allowed list
// - config flags presence and defaults
// - counts: active campaigns/leads and leads due immediately (offsetDays 0)
router.get('/domains', async (_req, res) => {
  try {
    const allowedDomains = (process.env.MAILGUN_ALLOWED_DOMAINS || '')
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);

    const v2Enabled = process.env.V2_MAILGUN_ENABLED === 'true';
    const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);
    const hasMailgunKey = Boolean(process.env.MAILGUN_API_KEY);
    const hasSigningKey = Boolean(process.env.MAILGUN_SIGNING_KEY);
    const defaultDomain = process.env.MAILGUN_DOMAIN_DEFAULT || process.env.MAILGUN_DOMAIN || '';

    // Load active campaigns
    const activeCampaigns = await dbV2
      .select({
        id: v2schema.campaigns.id,
        agentId: v2schema.campaigns.agentId,
        sequence: v2schema.campaigns.sequence,
      })
      .from(v2schema.campaigns)
      .where(eq(v2schema.campaigns.status, 'active'));

    const agentIds = Array.from(new Set(activeCampaigns.map((c) => c.agentId)));

    // Load agent domains for those agents
    const agents = agentIds.length
      ? await dbV2
          .select({ id: v2schema.agents.id, domain: v2schema.agents.domain })
          .from(v2schema.agents)
          .where(inArray(v2schema.agents.id, agentIds))
      : [];
    const agentDomainsInActiveCampaigns = Array.from(new Set(agents.map((a) => a.domain))).sort();

    // Compute missing domains
    const missingInAllowlist = agentDomainsInActiveCampaigns.filter((d) => !allowedDomains.includes(d));

    // Count active leads
    const [{ count: activeLeads }] = (await dbV2
      .select({ count: sql<number>`count(*)` })
      .from(v2schema.leads)
      .where(eq(v2schema.leads.status, 'active'))) as Array<{ count: number }>;

    // Determine campaigns with step 0 offsetDays === 0
    type Step = { offsetDays: number; subject: string; template: string };
    const immediateCampaignIds = activeCampaigns
      .filter((c) => Array.isArray(c.sequence) && (c.sequence as unknown as Step[])[0]?.offsetDays === 0)
      .map((c) => c.id);

    // Count leads due immediately: sequenceIndex=0 AND nextSendAt IS NULL in those campaigns
    const [{ count: immediateDueLeads }] = immediateCampaignIds.length
      ? ((await dbV2
          .select({ count: sql<number>`count(*)` })
          .from(v2schema.leads)
          .where(
            and(
              inArray(v2schema.leads.campaignId, immediateCampaignIds),
              eq(v2schema.leads.status, 'active'),
              eq(v2schema.leads.sequenceIndex, 0),
              isNull(v2schema.leads.nextSendAt)
            )
          )) as Array<{ count: number }>)
      : [{ count: 0 }];

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      allowedDomains,
      agentDomainsInActiveCampaigns,
      missingInAllowlist,
      config: {
        v2Enabled,
        hasOpenRouterKey,
        hasMailgunKey,
        hasSigningKey,
        defaultDomain,
      },
      counts: {
        activeCampaigns: activeCampaigns.length,
        activeLeads,
        immediateDueLeads,
      },
    });
  } catch (error) {
    console.error('V2 health domains error:', error);
    res.status(500).json({ success: false, error: 'Failed to compute V2 health domains' });
  }
});

// GET /v2/health/scheduler
// Returns campaign scheduler status and allows manual trigger
router.get('/scheduler', async (_req, res) => {
  try {
    const status = v2CampaignScheduler.getStatus();

    res.json({
      success: true,
      scheduler: {
        ...status,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          ENABLE_V2_CAMPAIGN_SCHEDULER: process.env.ENABLE_V2_CAMPAIGN_SCHEDULER
        }
      }
    });
  } catch (error) {
    console.error('Failed to get scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    });
  }
});

// POST /v2/health/scheduler/trigger
// Manually trigger campaign execution (for testing)
router.post('/scheduler/trigger', async (_req, res) => {
  try {
    const result = await v2CampaignScheduler.triggerNow();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        duration: result.duration
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Failed to trigger scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scheduler'
    });
  }
});

// POST /v2/health/scheduler/force-start
// Force start the scheduler (bypasses environment checks)
router.post('/scheduler/force-start', async (_req, res) => {
  try {
    v2CampaignScheduler.forceStart();
    const status = v2CampaignScheduler.getStatus();

    res.json({
      success: true,
      message: 'Scheduler force started',
      status
    });
  } catch (error) {
    console.error('Failed to force start scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force start scheduler'
    });
  }
});

export default router;

