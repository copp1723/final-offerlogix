import { db } from '../db';
import { campaigns } from '../../shared/schema';
import { eq, lte, and } from 'drizzle-orm';
// Reliability knobs
const SCHEDULER_INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS ?? 60_000); // 1 min default
const SCHEDULER_JITTER_MS = 5000; // avoid thundering herd
const CLAIM_LEASE_MS = Number(process.env.CAMPAIGN_CLAIM_LEASE_MS ?? 120_000); // lease while executing
const FAILURE_BACKOFF_MS = Number(process.env.CAMPAIGN_FAILURE_BACKOFF_MS ?? 300_000); // 5 min

function withJitter(baseMs: number) {
  const jitter = Math.floor(Math.random() * SCHEDULER_JITTER_MS);
  return baseMs + jitter;
}

export interface ScheduleConfig {
  scheduleType: 'immediate' | 'scheduled' | 'recurring';
  scheduledStart?: Date;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  recurringDays?: number[]; // [1,2,3,4,5] for weekdays
  recurringTime?: string; // "09:00:00"
}

export class CampaignScheduler {
  private static instance: CampaignScheduler;
  private schedulerInterval: NodeJS.Timeout | null = null;

  private loopInProgress = false;

  private async claimCampaign(campaignId: string, now: Date): Promise<boolean> {
    // Move nextExecution forward as a lease to prevent other workers from picking it up
    const leaseUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
    const result = await db.update(campaigns)
      .set({ nextExecution: leaseUntil, updatedAt: new Date() })
      .where(and(
        eq(campaigns.id, campaignId),
        eq(campaigns.status, 'scheduled' as any),
        lte(campaigns.nextExecution, now)
      ));
    // Drizzle doesn't always return affected rows count; re-read to confirm lease took
    const [after] = await db.select({ id: campaigns.id, nextExecution: campaigns.nextExecution })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    return !!(after && after.nextExecution && after.nextExecution.getTime() >= leaseUntil.getTime());
  }

  private computeNextFromRecurring(pattern: ScheduleConfig['recurringPattern'], days: number[] | undefined, timeStr: string | undefined, from: Date): Date {
    const base = new Date(from);
    const [hh, mm] = (timeStr || '09:00:00').split(':').map(Number);
    // Normalize to today at target time first
    const candidate = new Date(base);
    candidate.setSeconds(0, 0);
    candidate.setHours(hh ?? 9, mm ?? 0, 0, 0);

    if (pattern === 'daily') {
      if (candidate <= base) candidate.setDate(candidate.getDate() + 1);
      return candidate;
    }

    if (pattern === 'weekly') {
      const allowed = (days && days.length ? days : [1,2,3,4,5,6,0]); // default all days if not provided
      let d = new Date(candidate);
      for (let i = 0; i < 8; i++) {
        const dow = d.getDay();
        if (allowed.includes(dow) && d > base) return d;
        d.setDate(d.getDate() + 1);
        d.setHours(hh ?? 9, mm ?? 0, 0, 0);
      }
      // Fallback one week later
      const nextWeek = new Date(base);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(hh ?? 9, mm ?? 0, 0, 0);
      return nextWeek;
    }

    // monthly
    const next = new Date(candidate);
    next.setMonth(next.getMonth() + (candidate <= base ? 1 : 0));
    return next;
  }

  public static getInstance(): CampaignScheduler {
    if (!CampaignScheduler.instance) {
      CampaignScheduler.instance = new CampaignScheduler();
    }
    return CampaignScheduler.instance;
  }

  // Start the scheduler service
  public startScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval as unknown as NodeJS.Timeout);
    }

    const tick = async () => {
      if (this.loopInProgress) return; // prevent overlap if processing is slow
      this.loopInProgress = true;
      try {
        await this.processPendingCampaigns();
      } finally {
        this.loopInProgress = false;
      }
      this.schedulerInterval = setTimeout(tick, withJitter(SCHEDULER_INTERVAL_MS)) as unknown as NodeJS.Timeout;
    };
    // initial kick with jitter
    this.schedulerInterval = setTimeout(tick, withJitter(500)) as unknown as NodeJS.Timeout;

    console.log('📅 Campaign scheduler started');
  }

  // Stop the scheduler service
  public stopScheduler() {
    if (this.schedulerInterval) {
      clearTimeout(this.schedulerInterval as unknown as NodeJS.Timeout);
      this.schedulerInterval = null;
    }
    console.log('📅 Campaign scheduler stopped');
  }

  // Schedule a campaign
  public async scheduleCampaign(campaignId: string, config: ScheduleConfig) {
    const nextExecution = this.calculateNextExecution(config);
    
    await db.update(campaigns)
      .set({
        scheduleType: config.scheduleType,
        scheduledStart: config.scheduledStart,
        recurringPattern: config.recurringPattern,
        recurringDays: config.recurringDays || [],
        recurringTime: config.recurringTime,
        nextExecution,
        status: config.scheduleType === 'immediate' ? 'active' : 'scheduled',
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, campaignId));

    console.log(`📅 Campaign ${campaignId} scheduled with type: ${config.scheduleType}`);
    
    // If immediate, execute now
    if (config.scheduleType === 'immediate') {
      await this.executeCampaign(campaignId);
    }

    return nextExecution;
  }

  // Calculate next execution time based on schedule config
  private calculateNextExecution(config: ScheduleConfig): Date | null {
    if (config.scheduleType === 'immediate') {
      return new Date();
    }

    if (config.scheduleType === 'scheduled') {
      return config.scheduledStart || null;
    }

    if (config.scheduleType === 'recurring') {
      const now = new Date();
      return this.computeNextFromRecurring(
        config.recurringPattern!,
        config.recurringDays,
        config.recurringTime,
        now
      );
    }

    return null;
  }

  // Process campaigns that are ready to execute
  private async processPendingCampaigns() {
    const now = new Date();
    try {
      // Look for both 'scheduled' and 'active' campaigns (immediate campaigns are set to active)
      const pending = await db.select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.isActive, true),
            lte(campaigns.nextExecution, now)
            // Removed status filter to include both 'scheduled' and 'active' campaigns
          )
        );

      for (const c of pending) {
        try {
          // Attempt to claim by moving nextExecution forward as a short lease
          const claimed = await this.claimCampaign(c.id, now);
          if (!claimed) continue; // another worker got it

          await this.executeCampaign(c.id);

          if (c.scheduleType === 'recurring') {
            const nextExecution = this.calculateNextExecution({
              scheduleType: 'recurring',
              recurringPattern: c.recurringPattern as any,
              recurringDays: c.recurringDays as number[] | undefined,
              recurringTime: c.recurringTime || undefined
            });

            await db.update(campaigns)
              .set({ nextExecution, updatedAt: new Date() })
              .where(eq(campaigns.id, c.id));
          } else {
            await db.update(campaigns)
              .set({ status: 'completed' as any, nextExecution: null, updatedAt: new Date() })
              .where(eq(campaigns.id, c.id));
          }
        } catch (err) {
          console.error(`❌ Error executing campaign ${c.id}:`, err);
          // Push out nextExecution to avoid hot-looping on poison jobs
          await db.update(campaigns)
            .set({ nextExecution: new Date(Date.now() + FAILURE_BACKOFF_MS), updatedAt: new Date() })
            .where(eq(campaigns.id, c.id));
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending campaigns:', error);
    }
  }

  // Execute a campaign (send emails/SMS)
  public async executeCampaign(campaignId: string) {
    const startedAt = new Date();
    try {
      console.log(`🚀 Executing campaign: ${campaignId}`);

      // Get campaign with its assigned leads
      const { storage } = await import('../storage.js');
      const campaign = await storage.getCampaign(campaignId);

      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Get leads assigned to this campaign
      const leads = await storage.getLeadsByCampaign(campaignId);
      
      if (leads.length === 0) {
        console.warn(`⚠️ Campaign ${campaignId} has no assigned leads`);
        return { success: true, campaignId, emailsSent: 0, message: 'No leads to process' };
      }

      console.log(`📧 Found ${leads.length} leads assigned to campaign: ${campaign.name}`);

      // Update campaign status to active
      await db.update(campaigns)
        .set({ status: 'active' as any, updatedAt: new Date() })
        .where(eq(campaigns.id, campaignId));

      // Execute the campaign using ExecutionProcessor
      const { ExecutionProcessor } = await import('./campaign-execution/ExecutionProcessor.js');
      const processor = new ExecutionProcessor();

      const result = await processor.processEmailSequence(campaign, leads, 0, {
        batchSize: 50,
        delayBetweenEmails: 1000,
        testMode: false
      });

      console.log(`✅ Campaign ${campaignId} executed: ${result.emailsSent} emails sent, ${result.emailsFailed} failed`);

      return { 
        success: result.success, 
        campaignId,
        emailsSent: result.emailsSent,
        emailsFailed: result.emailsFailed,
        errors: result.errors
      };
    } catch (error) {
      console.error(`❌ Error executing campaign ${campaignId}:`, error);
      throw error;
    } finally {
      const finishedAt = new Date();
      console.log(`⏱️ Campaign ${campaignId} run time: ${finishedAt.getTime() - startedAt.getTime()}ms`);
    }
  }

  // Get campaign schedule status
  public async getCampaignSchedule(campaignId: string) {
    const [campaign] = await db.select({
      scheduleType: campaigns.scheduleType,
      scheduledStart: campaigns.scheduledStart,
      recurringPattern: campaigns.recurringPattern,
      recurringDays: campaigns.recurringDays,
      recurringTime: campaigns.recurringTime,
      nextExecution: campaigns.nextExecution,
      isActive: campaigns.isActive,
      status: campaigns.status
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));

    return campaign;
  }

  // Cancel scheduled campaign
  public async cancelScheduledCampaign(campaignId: string) {
    await db.update(campaigns)
      .set({
        status: 'draft',
        nextExecution: null,
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(campaigns.id, campaignId));

    console.log(`🚫 Campaign ${campaignId} schedule cancelled`);
  }
}

// Export singleton instance
export const campaignScheduler = CampaignScheduler.getInstance();
