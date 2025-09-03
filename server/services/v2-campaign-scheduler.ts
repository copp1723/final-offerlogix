/**
 * V2 Automated Campaign Scheduler
 * 
 * Runs V2 campaign sequences automatically on a daily schedule.
 * No manual intervention required - "set it and forget it" campaigns.
 */

import cron from 'node-cron';
import { runCampaignSequences } from '../v2/jobs/campaign-runner.js';

export class V2CampaignScheduler {
  private static instance: V2CampaignScheduler;
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  private constructor() {}

  static getInstance(): V2CampaignScheduler {
    if (!V2CampaignScheduler.instance) {
      V2CampaignScheduler.instance = new V2CampaignScheduler();
    }
    return V2CampaignScheduler.instance;
  }

  /**
   * Start the automated campaign scheduler
   */
  start(): void {
    // Only run in production and when explicitly enabled
    const isProduction = process.env.NODE_ENV === 'production';
    const isEnabled = process.env.ENABLE_V2_CAMPAIGN_SCHEDULER === 'true';

    console.log('📅 V2 Campaign scheduler initialization:', {
      NODE_ENV: process.env.NODE_ENV,
      ENABLE_V2_CAMPAIGN_SCHEDULER: process.env.ENABLE_V2_CAMPAIGN_SCHEDULER,
      isProduction,
      isEnabled
    });

    if (!isProduction || !isEnabled) {
      console.log('📅 V2 Campaign scheduler disabled (NODE_ENV or ENABLE_V2_CAMPAIGN_SCHEDULER)');
      return;
    }

    if (this.isRunning) {
      console.log('📅 V2 Campaign scheduler already running');
      return;
    }

    // Schedule to run daily at 9:00 AM Central Time
    // Cron format: minute hour day month dayOfWeek
    this.cronJob = cron.schedule('0 9 * * *', async () => {
      await this.executeCampaigns();
    }, {
      scheduled: true,
      timezone: "America/Chicago"
    });

    this.isRunning = true;
    console.log('📅 ✅ V2 Campaign scheduler started - running daily at 9:00 AM CT');
    console.log('📅 Next run:', this.getNextRunTime());
  }

  /**
   * Force start the scheduler (bypasses environment checks)
   */
  forceStart(): void {
    if (this.isRunning) {
      console.log('📅 V2 Campaign scheduler already running');
      return;
    }

    try {
      // Schedule to run daily at 9:00 AM Central Time
      this.cronJob = cron.schedule('0 9 * * *', async () => {
        await this.executeCampaigns();
      }, {
        scheduled: true,
        timezone: "America/Chicago"
      });

      this.isRunning = true;
      console.log('📅 ✅ V2 Campaign scheduler FORCE STARTED - running daily at 9:00 AM CT');
      console.log('📅 Next run:', this.getNextRunTime());
    } catch (error) {
      console.error('❌ Failed to force start V2 campaign scheduler:', error);
    }
  }

  /**
   * Stop the automated campaign scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('📅 V2 Campaign scheduler stopped');
  }

  /**
   * Get the next scheduled run time
   */
  getNextRunTime(): string {
    if (!this.cronJob) return 'Not scheduled';
    
    // Calculate next 9 AM CT
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    
    return tomorrow.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    nextRun: string;
    timezone: string;
    schedule: string;
  } {
    return {
      isRunning: this.isRunning,
      nextRun: this.getNextRunTime(),
      timezone: 'America/Chicago',
      schedule: 'Daily at 9:00 AM CT'
    };
  }

  /**
   * Execute campaign sequences (called by cron job)
   */
  private async executeCampaigns(): Promise<void> {
    const startTime = new Date();
    console.log('🕘 ⚡ V2 Automated campaign execution started:', startTime.toISOString());

    try {
      // Run all active V2 campaign sequences
      await runCampaignSequences();
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      console.log('✅ 🎉 V2 Automated campaign execution completed successfully');
      console.log(`⏱️ Duration: ${duration}ms`);
      console.log(`📅 Next run: ${this.getNextRunTime()}`);
      
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      console.error('❌ 🚨 V2 Automated campaign execution failed:', error);
      console.error(`⏱️ Failed after: ${duration}ms`);
      console.error(`📅 Will retry: ${this.getNextRunTime()}`);
      
      // Optional: Send alert to monitoring service
      // await this.sendAlert(error);
    }
  }

  /**
   * Manual trigger for testing (bypasses schedule)
   */
  async triggerNow(): Promise<{ success: boolean; message: string; duration?: number }> {
    if (!this.isRunning) {
      return {
        success: false,
        message: 'V2 Campaign scheduler is not running'
      };
    }

    const startTime = new Date();
    console.log('🔧 Manual V2 campaign trigger initiated');

    try {
      await runCampaignSequences();
      
      const duration = new Date().getTime() - startTime.getTime();
      
      return {
        success: true,
        message: 'V2 Campaign sequences executed successfully',
        duration
      };
    } catch (error) {
      const duration = new Date().getTime() - startTime.getTime();
      
      return {
        success: false,
        message: `V2 Campaign execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration
      };
    }
  }
}

// Export singleton instance
export const v2CampaignScheduler = V2CampaignScheduler.getInstance();
