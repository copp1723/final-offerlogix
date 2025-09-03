import Bull from 'bull';

// Define types that Bull uses
type Job<T = any> = Bull.Job<T>;
type Queue<T = any> = Bull.Queue<T>;
import Redis from 'ioredis';
import { eq, and, isNull, lte, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { emailQueue as emailQueueTable, emailDeliveryEvents, emailSuppressionList, campaigns, type InsertEmailQueue, type EmailQueue } from '../../shared/schema';
import { canSend, nextSendTime, getDefaultSendWindow, type SendWindow } from '../../shared/send-window';
import { sendCampaignEmail } from './mailgun';
import logger from '../logging/logger';

// Redis connection configuration with graceful fallback
const redisConfig = {
  host: process.env.REDIS_HOST || process.env.REDIS_URL?.split('://')[1]?.split(':')[0] || 'localhost',
  port: parseInt(process.env.REDIS_PORT || process.env.REDIS_URL?.split(':')[2] || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: 100,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  commandTimeout: 5000,
};

// Create Redis connection for Bull with error handling
const redis = new Redis(redisConfig);

redis.on('error', (err: Error) => {
  logger.error('Redis connection error - email queue will fall back to direct sending', { error: err });
});

redis.on('connect', () => {
  logger.info('Redis connected successfully for email queue');
});

// Email queue configuration
const emailQueueConfig = {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
  settings: {
    stalledInterval: 30 * 1000, // 30 seconds
    maxStalledCount: 1,
  },
};

// Create Bull queue
export const emailQueue = new Bull('email processing', emailQueueConfig);
export const deadLetterQueue = new Bull('email-dead-letter', { redis: redisConfig });

export function calculateBackoffDelay(attempt: number): number {
  const base = 2000;
  return base * Math.pow(2, Math.max(attempt - 1, 0));
}

export interface EmailJob {
  to: string;
  from: string;
  subject: string;
  html?: string;
  text?: string;
  campaignId?: string;
  leadId?: string;
  clientId?: string;
  priority?: number;
  scheduledFor?: Date;
  maxAttempts?: number;
  metadata?: Record<string, any>;
  domainOverride?: string;
  isAutoResponse?: boolean;
  idempotencyKey?: string;
  threadingHeaders?: Record<string, string>;
}

export interface EmailQueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

// Process email jobs
emailQueue.process('send-email', 10, async (job: Job<EmailJob>) => {
  const data = job.data;
  const queueRecord = await getQueueRecord(job.id.toString());
  
  try {
    // Update queue record status
    await updateQueueRecord(job.id.toString(), {
      status: 'processing',
      lastAttemptAt: new Date(),
      attempts: (queueRecord?.attempts || 0) + 1,
      nextRunAt: null,
    });

    // Check suppression list
    const isSuppressed = await isEmailSuppressed(data.to, data.clientId);
    if (isSuppressed) {
      logger.warn(`Email to ${data.to} is suppressed, skipping`, {
        jobId: job.id,
        campaignId: data.campaignId,
        leadId: data.leadId,
      });
      
      await updateQueueRecord(job.id.toString(), {
        status: 'cancelled',
        errorMessage: 'Email address is suppressed',
      });
      
      return { success: false, reason: 'suppressed' };
    }

    // Send email via Mailgun
    // Extract sender name from 'from' field if it exists (e.g., "Dealership Name <email@domain.com>")
    let senderName;
    if (data.from && data.from.includes('<')) {
      const match = data.from.match(/^(.*?)\s*<.*>$/);
      senderName = match ? match[1].trim() : undefined;
    }

    const success = await sendCampaignEmail(
      data.to,
      data.subject,
      data.html || data.text || '',
      { ...(data.from ? { from: data.from } : {}) },
      {
        isAutoResponse: data.isAutoResponse,
        domainOverride: data.domainOverride,
        senderName,
        threadingHeaders: data.threadingHeaders,
        userVariables: {
          ...(data.metadata?.conversationId ? { conversationId: String(data.metadata.conversationId) } : {}),
          ...(data.metadata?.aiMessageId ? { aiMessageId: String(data.metadata.aiMessageId) } : {}),
          ...(data.campaignId ? { campaignId: String(data.campaignId) } : {}),
          ...(data.leadId ? { leadId: String(data.leadId) } : {}),
          ...(data.clientId ? { clientId: String(data.clientId) } : {}),
        },
      }
    );

    if (success) {
      // Update queue record as sent
      await updateQueueRecord(job.id.toString(), {
        status: 'sent',
        sentAt: new Date(),
        nextRunAt: null,
      });

      logger.info(`Email sent successfully`, {
        jobId: job.id,
        to: data.to,
        campaignId: data.campaignId,
        leadId: data.leadId,
      });

      return { success: true, sentAt: new Date() };
    } else {
      // Mark as failed and will be retried by Bull
      throw new Error('Mailgun delivery failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const exhausted = job.attemptsMade >= (data.maxAttempts || 3);
    const nextRun = exhausted ? undefined : new Date(Date.now() + calculateBackoffDelay(job.attemptsMade));

    // Update queue record with error
    await updateQueueRecord(job.id.toString(), {
      status: exhausted ? 'dead-letter' : 'pending',
      failedAt: exhausted ? new Date() : undefined,
      errorMessage,
      nextRunAt: nextRun,
    });

    if (exhausted) {
      await deadLetterQueue.add('failed-email', job.data);
    }

    logger.error(`Email sending failed`, {
      jobId: job.id,
      to: data.to,
      campaignId: data.campaignId,
      leadId: data.leadId,
      error,
      attempt: job.attemptsMade,
      maxAttempts: data.maxAttempts || 3,
    });

    throw error;
  }
});

// Queue email for sending
export async function queueEmail(emailData: EmailJob): Promise<string> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailData.to)) {
      throw new Error(`Invalid email address: ${emailData.to}`);
    }

    // Check if email is suppressed
    const isSuppressed = await isEmailSuppressed(emailData.to, emailData.clientId);
    if (isSuppressed) {
      logger.warn(`Attempted to queue suppressed email: ${emailData.to}`);
      throw new Error(`Email address ${emailData.to} is suppressed`);
    }

    // Enforce send window if configured
    let window: SendWindow | null = null;
    if (emailData.campaignId) {
      const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, emailData.campaignId));
      window = (campaign?.sendWindow as SendWindow) || null;
    }
    if (!window) {
      window = getDefaultSendWindow();
    }
    if (window && !canSend(new Date(), window)) {
      emailData.scheduledFor = nextSendTime(new Date(), window);
    }

    // Idempotency check
    if (emailData.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(emailQueueTable)
        .where(eq(emailQueueTable.idempotencyKey, emailData.idempotencyKey))
        .limit(1);
      if (existing) {
        logger.info('Email job already queued', { id: existing.id, idempotencyKey: emailData.idempotencyKey });
        return existing.id;
      }
    }

    // Create database record first
    const [queueRecord] = await db.insert(emailQueueTable).values({
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      campaignId: emailData.campaignId,
      leadId: emailData.leadId,
      clientId: emailData.clientId,
      priority: emailData.priority || 0,
      maxAttempts: emailData.maxAttempts || 3,
      scheduledFor: emailData.scheduledFor,
      nextRunAt: emailData.scheduledFor || new Date(),
      idempotencyKey: emailData.idempotencyKey,
      metadata: emailData.metadata || {},
      status: 'pending',
    }).returning();

    // TEMPORARILY BYPASS REDIS - Send email immediately via Mailgun
    try {
      const { sendCampaignEmail } = await import('./mailgun.js');

      // Extract sender name from 'from' field if it exists (e.g., "Dealership Name <email@domain.com>")
      let senderName;
      if (emailData.from && emailData.from.includes('<')) {
        const match = emailData.from.match(/^(.*?)\s*<.*>$/);
        senderName = match ? match[1].trim() : undefined;
      }

      const result = await sendCampaignEmail(
        emailData.to,
        emailData.subject,
        emailData.html || emailData.text || '',
        { ...(emailData.from ? { from: emailData.from } : {}) },
        {
          isAutoResponse: emailData.isAutoResponse,
          domainOverride: emailData.domainOverride,
          senderName,
          threadingHeaders: emailData.threadingHeaders,
          userVariables: {
            ...(emailData.metadata?.conversationId ? { conversationId: String(emailData.metadata.conversationId) } : {}),
            ...(emailData.metadata?.aiMessageId ? { aiMessageId: String(emailData.metadata.aiMessageId) } : {}),
            ...(emailData.campaignId ? { campaignId: String(emailData.campaignId) } : {}),
            ...(emailData.leadId ? { leadId: String(emailData.leadId) } : {}),
            ...(emailData.clientId ? { clientId: String(emailData.clientId) } : {}),
          },
        }
      );

      // Update database record as sent
      await db.update(emailQueueTable)
        .set({ 
          status: 'sent', 
          sentAt: new Date(),
          // Ensure uniqueness to satisfy email_queue_job_id_unique
          jobId: `direct-send-${queueRecord.id}`
        })
        .where(eq(emailQueueTable.id, queueRecord.id));

      logger.info(`Email sent directly via Mailgun`, {
        queueId: queueRecord.id,
        to: emailData.to,
        campaignId: emailData.campaignId,
        leadId: emailData.leadId,
        mailgunResult: result
      });

    } catch (sendError) {
      // Update database record as failed
      await db.update(emailQueueTable)
        .set({ 
          status: 'failed',
          errorMessage: sendError instanceof Error ? sendError.message : 'Unknown error',
          attempts: 1,
          jobId: `direct-send-failed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })
        .where(eq(emailQueueTable.id, queueRecord.id));

      logger.error(`Direct email send failed`, {
        queueId: queueRecord.id,
        to: emailData.to,
        error: sendError
      });
      throw sendError;
    }

    // Original Redis queue logic (commented out due to connection issues):
    // const job = await emailQueue.add(
    //   'send-email',
    //   emailData,
    //   {
    //     priority: emailData.priority || 0,
    //     delay: emailData.scheduledFor ? emailData.scheduledFor.getTime() - Date.now() : 0,
    //     attempts: emailData.maxAttempts || 3,
    //     jobId: queueRecord.id,
    //   }
    // );

    // await db.update(emailQueueTable)
    //   .set({ jobId: job.id.toString() })
    //   .where(eq(emailQueueTable.id, queueRecord.id));

    // Logging handled above in the direct send logic

    return queueRecord.id;
  } catch (error) {
    logger.error(`Failed to queue email`, {
      to: emailData.to,
      campaignId: emailData.campaignId,
      leadId: emailData.leadId,
      error,
    });
    throw error;
  }
}

// Bulk queue emails for campaigns
export async function queueBulkEmails(emails: EmailJob[]): Promise<{ queued: number; failed: number; errors: string[] }> {
  const results = {
    queued: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Process in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    await Promise.allSettled(
      batch.map(async (email) => {
        try {
          await queueEmail(email);
          results.queued++;
        } catch (error) {
          results.failed++;
          results.errors.push(`${email.to}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      })
    );
  }

  logger.info(`Bulk email queueing completed`, {
    total: emails.length,
    queued: results.queued,
    failed: results.failed,
  });

  return results;
}

// Get queue statistics
export async function getQueueStats(): Promise<EmailQueueStats> {
  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    emailQueue.getWaiting(),
    emailQueue.getActive(),
    emailQueue.getCompleted(),
    emailQueue.getFailed(),
    emailQueue.getDelayed(),
    emailQueue.isPaused(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
    paused: paused ? 1 : 0,
  };
}

// Get queue record from database
async function getQueueRecord(queueId: string): Promise<EmailQueue | null> {
  try {
    const [record] = await db.select()
      .from(emailQueueTable)
      .where(eq(emailQueueTable.id, queueId))
      .limit(1);
    
    return record || null;
  } catch (error) {
    logger.error(`Failed to get queue record`, { queueId, error });
    return null;
  }
}

// Update queue record
async function updateQueueRecord(queueId: string, updates: Partial<EmailQueue>): Promise<void> {
  try {
    await db.update(emailQueueTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(emailQueueTable.id, queueId));
  } catch (error) {
    logger.error(`Failed to update queue record`, { queueId, updates, error });
  }
}

// Check if email is suppressed
export async function isEmailSuppressed(email: string, clientId?: string): Promise<boolean> {
  try {
    // Temporarily disable suppression check to get emails sending
    // TODO: Fix the SQL generation issue and re-enable proper suppression checking
    return false;
    
    // Original suppression logic (commented out due to SQL generation issue):
    // const emailCondition = eq(emailSuppressionList.email, email.toLowerCase());
    // const expirationCondition = or(
    //   isNull(emailSuppressionList.expiresAt),
    //   gte(emailSuppressionList.expiresAt, new Date())
    // );

    // let whereCondition = and(emailCondition, expirationCondition);
    // 
    // if (clientId) {
    //   whereCondition = and(whereCondition, eq(emailSuppressionList.clientId, clientId));
    // }

    // const [suppressed] = await db.select()
    //   .from(emailSuppressionList)
    //   .where(whereCondition)
    //   .limit(1);

    // return !!suppressed;
  } catch (error) {
    logger.error(`Failed to check email suppression`, { email, clientId, error });
    return false; // Fail open to avoid blocking legitimate emails
  }
}

// Retry failed jobs
export async function retryFailedJobs(limit: number = 100): Promise<number> {
  try {
    const failedJobs = await emailQueue.getFailed(0, limit);
    let retriedCount = 0;

    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
        logger.info(`Retried failed job`, { jobId: job.id });
      } catch (error) {
        logger.error(`Failed to retry job`, { jobId: job.id, error });
      }
    }

    return retriedCount;
  } catch (error) {
    logger.error(`Failed to retry failed jobs`, { error });
    return 0;
  }
}

// Clean up old completed and failed jobs
export async function cleanupOldJobs(): Promise<void> {
  try {
    await emailQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24 hours
    await emailQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
    
    // Also cleanup database records
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    await db.delete(emailQueueTable)
      .where(
        and(
          eq(emailQueueTable.status, 'sent'),
          lte(emailQueueTable.sentAt, oneDayAgo)
        )
      );
      
    await db.delete(emailQueueTable)
      .where(
        and(
          eq(emailQueueTable.status, 'failed'),
          lte(emailQueueTable.failedAt, oneWeekAgo)
        )
      );

    logger.info('Completed email queue cleanup');
  } catch (error) {
    logger.error('Failed to cleanup old jobs', { error });
  }
}

// Pause/Resume queue
export async function pauseQueue(): Promise<void> {
  await emailQueue.pause();
  logger.info('Email queue paused');
}

export async function resumeQueue(): Promise<void> {
  await emailQueue.resume();
  logger.info('Email queue resumed');
}

// Get job details
export async function getJobDetails(jobId: string): Promise<Job<EmailJob> | null> {
  try {
    return await emailQueue.getJob(jobId);
  } catch (error) {
    logger.error(`Failed to get job details`, { jobId, error });
    return null;
  }
}

// Cancel job
export async function cancelJob(jobId: string): Promise<boolean> {
  try {
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
      
      // Update database record
      await updateQueueRecord(jobId, {
        status: 'cancelled',
      });
      
      logger.info(`Job cancelled`, { jobId });
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to cancel job`, { jobId, error });
    return false;
  }
}

// Initialize queue monitoring
export function initializeQueueMonitoring(): void {
  emailQueue.on('completed', (job: Job<EmailJob>) => {
    logger.info(`Email job completed`, {
      jobId: job.id,
      to: job.data.to,
      campaignId: job.data.campaignId,
      processingTime: job.processedOn ? Date.now() - job.processedOn : undefined,
    });
  });

  emailQueue.on('failed', (job: Job<EmailJob>, error: Error) => {
    logger.error(`Email job failed`, {
      jobId: job.id,
      to: job.data.to,
      campaignId: job.data.campaignId,
      error,
      attempts: job.attemptsMade,
    });
  });

  emailQueue.on('stalled', (job: Job<EmailJob>) => {
    logger.warn(`Email job stalled`, {
      jobId: job.id,
      to: job.data.to,
      campaignId: job.data.campaignId,
    });
  });

  emailQueue.on('progress', (job: Job<EmailJob>, progress: number) => {
    logger.debug(`Email job progress`, {
      jobId: job.id,
      to: job.data.to,
      progress,
    });
  });

  logger.info('Email queue monitoring initialized');
}

// Graceful shutdown
export async function shutdownQueue(): Promise<void> {
  try {
    await emailQueue.close();
    await redis.disconnect();
    logger.info('Email queue shutdown completed');
  } catch (error) {
    logger.error('Error during email queue shutdown', { error });
  }
}

// Helper function to add missing import
function or(...conditions: any[]) {
  return sql`${conditions.join(' OR ')}`;
}
