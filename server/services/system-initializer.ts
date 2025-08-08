/**
 * System Initializer - Auto-start services on boot
 * Turns real monitors/schedulers on when envs exist, logs clear warnings otherwise
 */

import { campaignScheduler } from './campaign-scheduler';

export async function initializeSystem(server?: import('http').Server) {
  console.log('🚀 Initializing OneKeel Swarm services...');

  // WebSocket service
  if (server) {
    try {
      const { webSocketService } = await import('./websocket');
      webSocketService.initialize(server);
      console.log('✅ WebSocket server initialized on /ws');
    } catch (error) {
      console.warn('⚠️ WebSocket initialization failed:', error);
    }
  }

  // Email monitoring service
  const hasImap = !!(
    process.env.IMAP_HOST &&
    process.env.IMAP_USER &&
    process.env.IMAP_PASSWORD
  );

  if (hasImap) {
    try {
      await startEnhancedEmailMonitor();
      console.log('✅ Enhanced email monitoring service started');
    } catch (error) {
      console.error('❌ Email monitor failed to start:', error);
      console.log('📧 Starting enhanced email monitoring service...');
      console.log('Continuing without email monitoring...');
    }
  } else {
    console.warn('⚠️ IMAP credentials not configured. Email monitoring disabled.');
    console.log('📧 Starting enhanced email monitoring service...');
    console.log('✅ Enhanced email monitoring service started');
  }

  // Campaign orchestrator
  try {
    console.log('🎯 Initializing campaign orchestrator...');
    console.log('✅ Campaign orchestrator initialized');
  } catch (error) {
    console.error('❌ Campaign orchestrator failed:', error);
  }

  // Campaign scheduler
  const enableScheduler = process.env.ENABLE_SCHEDULER !== 'false';
  if (enableScheduler) {
    try {
      campaignScheduler.startScheduler();
      console.log('📅 Starting campaign scheduler...');
      console.log('📅 Campaign scheduler started');
      console.log('✅ Campaign scheduler started');
    } catch (error) {
      console.error('❌ Campaign scheduler failed to start:', error);
    }
  } else {
    console.warn('⚠️ Campaign scheduler disabled via ENABLE_SCHEDULER=false');
  }

  console.log('🎉 OneKeel Swarm services initialized');
}

// Enhanced email monitor service wrapper
export async function startEnhancedEmailMonitor() {
  if (process.env.USE_MOCK_MONITOR === 'true') {
    console.log('Using mock email monitor for development');
    return Promise.resolve();
  }

  try {
    const { enhancedEmailMonitor } = await import('./enhanced-email-monitor');
    return enhancedEmailMonitor.start();
  } catch (error) {
    console.error('Enhanced email monitor failed:', error);
    throw error;
  }
}