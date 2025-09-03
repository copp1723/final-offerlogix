/**
 * System Initializer - Auto-start services on boot
 * Turns real monitors/schedulers on when envs exist, logs clear warnings otherwise
 */

import { campaignScheduler } from './campaign-scheduler';
import { log } from '../logging';

export async function initializeSystem(server?: import('http').Server) {
  log.info('🚀 Initializing OneKeel Swarm services', {
    component: 'system',
    operation: 'initialization_start'
  });

  // WebSocket service
  if (server) {
    try {
      const { webSocketService } = await import('./websocket.js');
      webSocketService.initialize(server);
      // WebSocket service logs its own success; avoid duplicate here.
    } catch (error) {
      log.warn('⚠️ WebSocket initialization failed', {
        component: 'websocket',
        operation: 'initialization_failed',
        error: error as Error
      });
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
      const started = await startEnhancedEmailMonitor();
      if (started) {
        log.info('✅ Enhanced email monitoring service started', {
          component: 'email_monitor',
          operation: 'service_started'
        });
      }
    } catch (error) {
      log.error('❌ Email monitor failed to start', {
        component: 'email_monitor',
        operation: 'startup_failed',
        error: error as Error,
        severity: 'high'
      });
      log.warn('📧 Email monitoring disabled due to startup error', {
        component: 'email_monitor',
        operation: 'service_disabled'
      });
    }
  } else {
    log.warn('⚠️ IMAP credentials not configured. Email monitoring disabled', {
      component: 'email_monitor',
      operation: 'config_missing',
      missingConfig: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASSWORD']
    });
    // Do not log "started" when disabled.
  }

  // Campaign orchestrator
  try {
    log.info('🎯 Initializing campaign orchestrator', {
      component: 'campaign_orchestrator',
      operation: 'initialization'
    });
    log.info('✅ Campaign orchestrator initialized', {
      component: 'campaign_orchestrator',
      operation: 'initialization_complete'
    });
  } catch (error) {
    log.error('❌ Campaign orchestrator failed', {
      component: 'campaign_orchestrator',
      operation: 'initialization_failed',
      error: error as Error,
      severity: 'high'
    });
  }

  // Campaign scheduler
  const enableScheduler = process.env.ENABLE_SCHEDULER !== 'false';
  if (enableScheduler) {
    try {
      campaignScheduler.startScheduler();
      // Scheduler logs internally; avoid duplicates here.
    } catch (error) {
      log.error('❌ Campaign scheduler failed to start', {
        component: 'campaign_scheduler',
        operation: 'startup_failed',
        error: error as Error,
        severity: 'high'
      });
    }
  } else {
    log.warn('⚠️ Campaign scheduler disabled via ENABLE_SCHEDULER=false', {
      component: 'campaign_scheduler',
      operation: 'service_disabled',
      reason: 'env_var_disabled'
    });
  }

  // Email reliability system
  const hasRedis = !!(process.env.REDIS_HOST || process.env.REDIS_URL);
  if (hasRedis) {
    try {
      const { initializeEmailReliabilitySystem } = await import('./email-reliability-initializer.js');
      await initializeEmailReliabilitySystem();
      log.info('✅ Email reliability system initialized', {
        component: 'email_reliability',
        operation: 'service_started'
      });
    } catch (error) {
      log.error('❌ Email reliability system failed to start', {
        component: 'email_reliability',
        operation: 'startup_failed',
        error: error as Error,
        severity: 'medium'
      });
      log.warn('📧 Email reliability features disabled due to startup error', {
        component: 'email_reliability',
        operation: 'service_disabled'
      });
    }
  } else {
    log.warn('⚠️ Redis not configured. Email reliability system disabled', {
      component: 'email_reliability',
      operation: 'config_missing',
      missingConfig: ['REDIS_HOST or REDIS_URL'],
      note: 'Falling back to direct email sending'
    });
  }

  log.info('🎉 OneKeel Swarm services initialized successfully', {
    component: 'system',
    operation: 'initialization_complete'
  });
}

// Enhanced email monitor service wrapper
export async function startEnhancedEmailMonitor(): Promise<boolean> {
  try {
    const { enhancedEmailMonitor } = await import('./enhanced-email-monitor.js');
    return enhancedEmailMonitor.start();
  } catch (error) {
    log.error('Enhanced email monitor import failed', {
      component: 'email_monitor',
      operation: 'import_failed',
      error: error as Error,
      severity: 'medium'
    });
    // Don't throw - let the server continue without email monitoring
    return Promise.resolve(false);
  }
}