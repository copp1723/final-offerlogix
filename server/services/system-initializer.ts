import { emailMonitorService } from './email-monitor';

export class SystemInitializer {
  static async initializeServices() {
    console.log('🚀 Initializing AutoCampaigns AI services...');
    
    try {
      // Initialize Email Monitor
      console.log('📧 Starting email monitoring service...');
      await emailMonitorService.start();
      console.log('✅ Email monitoring service started');
    } catch (error) {
      console.warn('⚠️ Email monitoring not started:', error instanceof Error ? error.message : 'Unknown error');
    }

    console.log('🎉 AutoCampaigns AI services initialized');
  }

  static async shutdownServices() {
    console.log('🛑 Shutting down AutoCampaigns AI services...');
    
    try {
      await emailMonitorService.stop();
      console.log('✅ Email monitoring service stopped');
    } catch (error) {
      console.error('❌ Error stopping email monitoring:', error);
    }

    console.log('👋 AutoCampaigns AI services shutdown complete');
  }
}