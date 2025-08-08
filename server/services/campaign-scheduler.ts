import { db } from '../db';
import { campaigns } from '../../shared/schema';
import { eq, lte, and } from 'drizzle-orm';
import { sendSMS } from './twilio';

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

  public static getInstance(): CampaignScheduler {
    if (!CampaignScheduler.instance) {
      CampaignScheduler.instance = new CampaignScheduler();
    }
    return CampaignScheduler.instance;
  }

  // Start the scheduler service
  public startScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    // Check every minute for scheduled campaigns
    this.schedulerInterval = setInterval(() => {
      this.processPendingCampaigns();
    }, 60000);

    console.log('📅 Campaign scheduler started');
  }

  // Stop the scheduler service
  public stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
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
      const [hours, minutes] = (config.recurringTime || '09:00:00').split(':').map(Number);
      
      switch (config.recurringPattern) {
        case 'daily':
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(hours, minutes, 0, 0);
          return tomorrow;

        case 'weekly':
          const nextWeek = new Date(now);
          nextWeek.setDate(nextWeek.getDate() + 7);
          nextWeek.setHours(hours, minutes, 0, 0);
          return nextWeek;

        case 'monthly':
          const nextMonth = new Date(now);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          nextMonth.setHours(hours, minutes, 0, 0);
          return nextMonth;
      }
    }

    return null;
  }

  // Process campaigns that are ready to execute
  private async processPendingCampaigns() {
    try {
      const now = new Date();
      const pendingCampaigns = await db.select()
        .from(campaigns)
        .where(
          and(
            eq(campaigns.isActive, true),
            lte(campaigns.nextExecution, now),
            eq(campaigns.status, 'scheduled')
          )
        );

      for (const campaign of pendingCampaigns) {
        await this.executeCampaign(campaign.id);
        
        // If recurring, schedule next execution
        if (campaign.scheduleType === 'recurring') {
          const nextExecution = this.calculateNextExecution({
            scheduleType: 'recurring',
            recurringPattern: campaign.recurringPattern as any,
            recurringDays: campaign.recurringDays as number[],
            recurringTime: campaign.recurringTime
          });

          await db.update(campaigns)
            .set({ 
              nextExecution,
              updatedAt: new Date()
            })
            .where(eq(campaigns.id, campaign.id));
        } else {
          // Mark one-time scheduled campaign as completed
          await db.update(campaigns)
            .set({ 
              status: 'completed',
              nextExecution: null,
              updatedAt: new Date()
            })
            .where(eq(campaigns.id, campaign.id));
        }
      }
    } catch (error) {
      console.error('❌ Error processing pending campaigns:', error);
    }
  }

  // Execute a campaign (send emails/SMS)
  public async executeCampaign(campaignId: string) {
    try {
      console.log(`🚀 Executing campaign: ${campaignId}`);
      
      const [campaign] = await db.select()
        .from(campaigns)
        .where(eq(campaigns.id, campaignId));

      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Update campaign status to active
      await db.update(campaigns)
        .set({ 
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(campaigns.id, campaignId));

      // Here you would implement the actual email/SMS sending logic
      // This is where you'd integrate with your lead management system
      console.log(`✅ Campaign ${campaignId} executed successfully`);

      return { success: true, campaignId };
    } catch (error) {
      console.error(`❌ Error executing campaign ${campaignId}:`, error);
      throw error;
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