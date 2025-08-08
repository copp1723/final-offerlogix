import { emailMonitorService } from './email-monitor';
import { enhancedEmailMonitor } from './enhanced-email-monitor';
import { campaignOrchestrator } from './campaign-execution/CampaignOrchestrator';

export class SystemInitializer {
  static async initializeServices() {
    console.log('🚀 Initializing AutoCampaigns AI services...');
    
    try {
      // Seed default AI agent configuration
      const { seedDefaultAiConfig } = await import('./default-ai-config');
      await seedDefaultAiConfig();
      
      // Initialize Enhanced Email Monitor (upgraded from basic)
      console.log('📧 Starting enhanced email monitoring service...');
      await enhancedEmailMonitor.start();
      console.log('✅ Enhanced email monitoring service started');

      // Initialize Campaign Orchestrator
      console.log('🎯 Initializing campaign orchestrator...');
      // Campaign orchestrator is ready for use
      console.log('✅ Campaign orchestrator initialized');

      // Start campaign scheduler
      console.log('📅 Starting campaign scheduler...');
      const { campaignScheduler } = await import('./campaign-scheduler');
      campaignScheduler.startScheduler();
      console.log('✅ Campaign scheduler started');

    } catch (error) {
      console.warn('⚠️ Service initialization warning:', error instanceof Error ? error.message : 'Unknown error');
    }

    console.log('🎉 AutoCampaigns AI services initialized');
  }

  static async shutdownServices() {
    console.log('🛑 Shutting down AutoCampaigns AI services...');
    
    try {
      await enhancedEmailMonitor.stop();
      console.log('✅ Enhanced email monitoring service stopped');
    } catch (error) {
      console.error('❌ Error stopping enhanced email monitoring:', error);
    }

    try {
      const { campaignScheduler } = await import('./campaign-scheduler');
      campaignScheduler.stopScheduler();
      console.log('✅ Campaign scheduler stopped');
    } catch (error) {
      console.error('❌ Error stopping campaign scheduler:', error);
    }

    console.log('👋 AutoCampaigns AI services shutdown complete');
  }
}