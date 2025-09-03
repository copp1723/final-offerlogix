import { initializeQueueMonitoring, cleanupOldJobs } from './email-queue';
import { cleanupExpiredSuppressions } from './suppression-manager';
import logger from '../logging/logger';
import { createErrorContext } from '../utils/error-utils';

/**
 * Initialize the email reliability system
 */
export async function initializeEmailReliabilitySystem(): Promise<void> {
  try {
    logger.info('Initializing email reliability system...');

    // Initialize queue monitoring
    initializeQueueMonitoring();

    // Schedule periodic cleanup tasks
    scheduleMaintenanceTasks();

    logger.info('Email reliability system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize email reliability system', createErrorContext(error));
    throw error;
  }
}

/**
 * Schedule maintenance tasks
 */
function scheduleMaintenanceTasks(): void {
  // Clean up old jobs every hour
  setInterval(async () => {
    try {
      await cleanupOldJobs();
      logger.debug('Email queue cleanup completed');
    } catch (error) {
      logger.error('Email queue cleanup failed', createErrorContext(error));
    }
  }, 60 * 60 * 1000); // 1 hour

  // Clean up expired suppressions every 6 hours
  setInterval(async () => {
    try {
      const deletedCount = await cleanupExpiredSuppressions();
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired suppressions`);
      }
    } catch (error) {
      logger.error('Suppression cleanup failed', createErrorContext(error));
    }
  }, 6 * 60 * 60 * 1000); // 6 hours

  logger.info('Email reliability maintenance tasks scheduled');
}

/**
 * Graceful shutdown of email reliability system
 */
export async function shutdownEmailReliabilitySystem(): Promise<void> {
  try {
    logger.info('Shutting down email reliability system...');
    
    // Import and shutdown queue
    const { shutdownQueue } = await import('./email-queue.js');
    await shutdownQueue();
    
    logger.info('Email reliability system shutdown completed');
  } catch (error) {
    logger.error('Error during email reliability system shutdown', { error });
  }
}

/**
 * Health check for email reliability system
 */
export async function checkEmailReliabilityHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  details: Record<string, any>;
}> {
  const checks: Record<string, boolean> = {};
  const details: Record<string, any> = {};

  try {
    // Check queue connection
    const { getQueueStats } = await import('./email-queue.js');
    const queueStats = await getQueueStats();
    checks.queue = true;
    details.queueStats = queueStats;
  } catch (error) {
    checks.queue = false;
    details.queueError = error instanceof Error ? error.message : 'Unknown error';
  }

  try {
    // Check suppression system
    const { getSuppressionStats } = await import('./suppression-manager.js');
    const suppressionStats = await getSuppressionStats();
    checks.suppression = true;
    details.suppressionStats = suppressionStats;
  } catch (error) {
    checks.suppression = false;
    details.suppressionError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(check => check);
  const anyHealthy = Object.values(checks).some(check => check);
  
  const status = allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy';

  return { status, checks, details };
}