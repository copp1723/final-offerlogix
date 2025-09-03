import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { 
  getQueueStats, 
  queueEmail, 
  getJobDetails, 
  cancelJob, 
  retryFailedJobs,
  pauseQueue,
  resumeQueue,
  cleanupOldJobs,
} from '../services/email-queue';
import {
  getSuppressionStats,
  getSuppressionList,
  addToSuppressionList,
  removeFromSuppressionList,
  getSuppressionEntry,
  cleanupExpiredSuppressions,
} from '../services/suppression-manager';
import {
  processWebhookEvent,
  getCampaignDeliveryEvents,
  getEmailDeliveryEvents,
} from '../services/mailgun-webhook-handler';
import logger from '../logging/logger';

const router = express.Router();

// Validation middleware helper
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      error: 'Validation failed',
      details: errors.array() 
    });
  }
  next();
};

// ===================
// EMAIL QUEUE ROUTES
// ===================

/**
 * Get email queue statistics
 */
router.get('/queue/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getQueueStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get queue stats', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve queue statistics' 
    });
  }
});

/**
 * Queue a new email
 */
router.post('/queue/send', 
  authenticateToken,
  [
    body('to').isEmail().withMessage('Valid email address required'),
    body('from').isEmail().withMessage('Valid from email required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('html').optional().isString(),
    body('text').optional().isString(),
    body('campaignId').optional().isString(),
    body('leadId').optional().isString(),
    body('priority').optional().isInt({ min: 0, max: 10 }),
    body('scheduledFor').optional().isISO8601(),
    body('maxAttempts').optional().isInt({ min: 1, max: 10 }),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const emailData = {
        ...req.body,
        clientId: req.user?.clientId,
        scheduledFor: req.body.scheduledFor ? new Date(req.body.scheduledFor) : undefined,
      };

      const queueId = await queueEmail(emailData);
      
      res.status(201).json({ 
        success: true, 
        data: { queueId },
        message: 'Email queued successfully'
      });
    } catch (error) {
      logger.error('Failed to queue email', { error, body: req.body });
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to queue email'
      });
    }
  }
);

/**
 * Get job details
 */
router.get('/queue/job/:jobId',
  authenticateToken,
  [param('jobId').notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const job = await getJobDetails(jobId);
      
      if (!job) {
        return res.status(404).json({ 
          success: false, 
          error: 'Job not found' 
        });
      }

      res.json({ 
        success: true, 
        data: {
          id: job.id,
          data: job.data,
          opts: job.opts,
          progress: job.progress(),
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
        }
      });
    } catch (error) {
      logger.error('Failed to get job details', { error, jobId: req.params.jobId });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve job details' 
      });
    }
  }
);

/**
 * Cancel a job
 */
router.delete('/queue/job/:jobId',
  authenticateToken,
  [param('jobId').notEmpty().withMessage('Job ID is required')],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const cancelled = await cancelJob(jobId);
      
      if (!cancelled) {
        return res.status(404).json({ 
          success: false, 
          error: 'Job not found or could not be cancelled' 
        });
      }

      res.json({ 
        success: true, 
        message: 'Job cancelled successfully' 
      });
    } catch (error) {
      logger.error('Failed to cancel job', { error, jobId: req.params.jobId });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to cancel job' 
      });
    }
  }
);

/**
 * Retry failed jobs
 */
router.post('/queue/retry-failed',
  authenticateToken,
  [
    body('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = req.body.limit || 100;
      const retriedCount = await retryFailedJobs(limit);
      
      res.json({ 
        success: true, 
        data: { retriedCount },
        message: `Retried ${retriedCount} failed jobs`
      });
    } catch (error) {
      logger.error('Failed to retry failed jobs', { error });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retry failed jobs' 
      });
    }
  }
);

/**
 * Pause/Resume queue
 */
router.post('/queue/:action',
  authenticateToken,
  [param('action').isIn(['pause', 'resume']).withMessage('Action must be pause or resume')],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action } = req.params;
      
      if (action === 'pause') {
        await pauseQueue();
      } else {
        await resumeQueue();
      }
      
      res.json({ 
        success: true, 
        message: `Queue ${action}d successfully` 
      });
    } catch (error) {
      logger.error(`Failed to ${req.params.action} queue`, { error });
      res.status(500).json({ 
        success: false, 
        error: `Failed to ${req.params.action} queue` 
      });
    }
  }
);

/**
 * Cleanup old jobs
 */
router.post('/queue/cleanup', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await cleanupOldJobs();
    res.json({ 
      success: true, 
      message: 'Queue cleanup completed' 
    });
  } catch (error) {
    logger.error('Failed to cleanup queue', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cleanup queue' 
    });
  }
});

// =========================
// SUPPRESSION LIST ROUTES
// =========================

/**
 * Get suppression statistics
 */
router.get('/suppression/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await getSuppressionStats(req.user?.clientId);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get suppression stats', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve suppression statistics' 
    });
  }
});

/**
 * Get suppression list
 */
router.get('/suppression/list',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('suppressionType').optional().isIn(['bounce', 'complaint', 'unsubscribe', 'manual']),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const suppressionType = req.query.suppressionType as string;
      
      const result = await getSuppressionList({
        clientId: req.user?.clientId,
        suppressionType,
        page,
        limit,
      });
      
      res.json({ 
        success: true, 
        data: result,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: Math.ceil(result.total / limit),
        }
      });
    } catch (error) {
      logger.error('Failed to get suppression list', { error });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve suppression list' 
      });
    }
  }
);

/**
 * Add email to suppression list
 */
router.post('/suppression/add',
  authenticateToken,
  [
    body('email').isEmail().withMessage('Valid email address required'),
    body('suppressionType').isIn(['bounce', 'complaint', 'unsubscribe', 'manual']).withMessage('Valid suppression type required'),
    body('reason').optional().isString(),
    body('bounceType').optional().isIn(['hard', 'soft']),
    body('campaignId').optional().isString(),
    body('leadId').optional().isString(),
    body('expiresAt').optional().isISO8601(),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const entry = {
        ...req.body,
        clientId: req.user?.clientId,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      };

      const success = await addToSuppressionList(entry);
      
      if (success) {
        res.status(201).json({ 
          success: true, 
          message: 'Email added to suppression list' 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          error: 'Failed to add email to suppression list' 
        });
      }
    } catch (error) {
      logger.error('Failed to add to suppression list', { error, body: req.body });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add email to suppression list' 
      });
    }
  }
);

/**
 * Remove email from suppression list
 */
router.delete('/suppression/:email',
  authenticateToken,
  [param('email').isEmail().withMessage('Valid email address required')],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email } = req.params;
      const success = await removeFromSuppressionList(email, req.user?.clientId);
      
      if (success) {
        res.json({ 
          success: true, 
          message: 'Email removed from suppression list' 
        });
      } else {
        res.status(404).json({ 
          success: false, 
          error: 'Email not found in suppression list' 
        });
      }
    } catch (error) {
      logger.error('Failed to remove from suppression list', { error, email: req.params.email });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to remove email from suppression list' 
      });
    }
  }
);

/**
 * Get suppression entry details
 */
router.get('/suppression/:email',
  authenticateToken,
  [param('email').isEmail().withMessage('Valid email address required')],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email } = req.params;
      const entry = await getSuppressionEntry(email, req.user?.clientId);
      
      if (entry) {
        res.json({ success: true, data: entry });
      } else {
        res.status(404).json({ 
          success: false, 
          error: 'Email not found in suppression list' 
        });
      }
    } catch (error) {
      logger.error('Failed to get suppression entry', { error, email: req.params.email });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve suppression entry' 
      });
    }
  }
);

/**
 * Cleanup expired suppressions
 */
router.post('/suppression/cleanup', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deletedCount = await cleanupExpiredSuppressions();
    res.json({ 
      success: true, 
      data: { deletedCount },
      message: `Cleaned up ${deletedCount} expired suppressions`
    });
  } catch (error) {
    logger.error('Failed to cleanup expired suppressions', { error });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cleanup expired suppressions' 
    });
  }
});

// ==================
// WEBHOOK ROUTES
// ==================

/**
 * Mailgun webhook endpoint
 * This endpoint should not require authentication as it's called by Mailgun
 */
router.post('/webhook/mailgun', async (req: Request, res: Response) => {
  try {
    const success = await processWebhookEvent(req.body);
    
  if (success) {
      res.status(200).json({ received: true });
    } else {
      res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } catch (error) {
    logger.error('Webhook processing failed', { error, body: req.body });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===================
// DELIVERY EVENTS
// ===================

/**
 * Get campaign delivery events
 */
router.get('/delivery-events/campaign/:campaignId',
  authenticateToken,
  [
    param('campaignId').notEmpty().withMessage('Campaign ID is required'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { campaignId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      
      const events = await getCampaignDeliveryEvents(campaignId, limit);
      
      res.json({ 
        success: true, 
        data: events 
      });
    } catch (error) {
      logger.error('Failed to get campaign delivery events', { error, campaignId: req.params.campaignId });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve delivery events' 
      });
    }
  }
);

/**
 * Get email delivery events
 */
router.get('/delivery-events/email/:email',
  authenticateToken,
  [
    param('email').isEmail().withMessage('Valid email address required'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  ],
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { email } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const events = await getEmailDeliveryEvents(email, limit);
      
      res.json({ 
        success: true, 
        data: events 
      });
    } catch (error) {
      logger.error('Failed to get email delivery events', { error, email: req.params.email });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve delivery events' 
      });
    }
  }
);

export default router;