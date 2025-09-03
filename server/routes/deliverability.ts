/**
 * Deliverability API Routes
 * Enhanced endpoints for email validation, content analysis, and rate limiting
 */

import { Router } from 'express';
import { DomainHealthGuard } from '../services/deliverability/DomainHealthGuard';
import { SuppressionManager } from '../services/deliverability/SuppressionManager';
import { EnhancedEmailValidator } from '../services/enhanced-email-validator';
import { EmailContentAnalyzer } from '../services/email-content-analyzer';
import { EmailRateLimiters } from '../services/email-rate-limiter';
import { mailgunService } from '../services/email/mailgun-service';
import { storage } from '../storage';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/deliverability/health
 * Enhanced health check with validation and rate limiting stats
 */
router.get('/health', async (req, res) => {
  try {
    await DomainHealthGuard.assertAuthReady();
    const health = await DomainHealthGuard.checkDeliverabilityHealth();
    const emailServiceStatus = mailgunService.getStatus();
    const bounceStats = EnhancedEmailValidator.getBounceStats();
    
    res.json({
      status: 'healthy',
      ...health,
      emailService: emailServiceStatus,
      bounces: bounceStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/deliverability/validate-email
 * Validate single email address with enhanced checks
 */
const validateEmailSchema = z.object({
  email: z.string().min(1, 'Email is required')
});

router.post('/validate-email',
  validateRequest({ body: validateEmailSchema }),
  async (req, res) => {
    try {
      const { email } = req.body;
      const validation = EnhancedEmailValidator.validateEmail(email);
      
      res.json({
        email,
        ...validation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Email validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deliverability/validate-list
 * Validate list of email addresses
 */
const validateListSchema = z.object({
  emails: z.array(z.string()).min(1, 'At least one email is required').max(1000, 'Maximum 1000 emails per request')
});

router.post('/validate-list',
  validateRequest({ body: validateListSchema }),
  async (req, res) => {
    try {
      const { emails } = req.body;
      const result = EnhancedEmailValidator.cleanEmailList(emails);
      
      res.json({
        ...result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'List validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deliverability/analyze-content
 * Analyze email content for spam indicators
 */
const analyzeContentSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required')
});

router.post('/analyze-content',
  validateRequest({ body: analyzeContentSchema }),
  async (req, res) => {
    try {
      const { subject, body } = req.body;
      const analysis = EmailContentAnalyzer.analyzeContent(subject, body);
      
      res.json({
        ...analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Content analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/deliverability/rate-limits/:identifier
 * Check rate limit status for user or campaign
 */
router.get('/rate-limits/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { type = 'user' } = req.query;
    
    let usage;
    if (type === 'user') {
      usage = {
        hourly: EmailRateLimiters.userHourly.getUsage(identifier),
        burst: EmailRateLimiters.burstProtection.getUsage(identifier)
      };
    } else if (type === 'campaign') {
      usage = {
        hourly: EmailRateLimiters.campaignHourly.getUsage(identifier)
      };
    } else {
      return res.status(400).json({ error: 'Invalid type. Use "user" or "campaign"' });
    }
    
    res.json({
      identifier,
      type,
      usage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get rate limit status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/deliverability/stats
 * Get comprehensive deliverability statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const bounceStats = EnhancedEmailValidator.getBounceStats();
    const emailStats = mailgunService.getEmailStats();
    
    res.json({
      bounces: bounceStats,
      rateLimits: emailStats.rateLimits,
      service: mailgunService.getStatus(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get deliverability stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/deliverability/suppressions
 * Get suppression statistics and recent suppressions
 */
router.get('/suppressions', async (req, res) => {
  try {
    const clientId = req.query.clientId as string;
    const stats = await SuppressionManager.getSuppressionStats(clientId);
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve suppression stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/deliverability/suppressions/remove
 * Remove email from enhanced suppression system
 */
const removeSuppressionSchema = z.object({
  email: z.string().email('Invalid email address')
});

router.post('/suppressions/remove', 
  validateRequest({ body: removeSuppressionSchema }),
  async (req, res) => {
    try {
      const { email } = req.body;
      
      // Remove from both systems
      await SuppressionManager.removeSuppression(email);
      const enhancedResult = EnhancedEmailValidator.removeSuppression(email);
      
      res.json({
        success: true,
        message: `Suppression removed for ${email}`,
        enhancedSystem: enhancedResult
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to remove suppression',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deliverability/admin/reset-rate-limit
 * Admin endpoint to reset rate limits
 */
const resetRateLimitSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  type: z.enum(['user', 'campaign']).default('user')
});

router.post('/admin/reset-rate-limit',
  validateRequest({ body: resetRateLimitSchema }),
  async (req, res) => {
    try {
      const { identifier, type } = req.body;
      
      mailgunService.admin.resetRateLimit(identifier, type);
      
      res.json({
        success: true,
        message: `Rate limit reset for ${type}: ${identifier}`
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to reset rate limit',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deliverability/admin/record-bounce
 * Admin endpoint to manually record a bounce
 */
const recordBounceSchema = z.object({
  email: z.string().email('Invalid email address'),
  type: z.enum(['soft', 'hard']).default('soft')
});

router.post('/admin/record-bounce',
  validateRequest({ body: recordBounceSchema }),
  async (req, res) => {
    try {
      const { email, type } = req.body;
      
      EnhancedEmailValidator.recordBounce(email, type);
      
      res.json({
        success: true,
        message: `${type} bounce recorded for ${email}`,
        isSuppressed: EnhancedEmailValidator.isSuppressed(email)
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to record bounce',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deliverability/suppressions/add
 * Manually add email to suppression list
 */
const addSuppressionSchema = z.object({
  email: z.string().email('Invalid email address'),
  reason: z.string().min(1, 'Reason is required')
});

router.post('/suppressions/add',
  validateRequest({ body: addSuppressionSchema }),
  async (req, res) => {
    try {
      const { email, reason } = req.body;
      await SuppressionManager.suppressLead(email, reason, 'manual');
      
      res.json({
        success: true,
        message: `Email ${email} added to suppression list`
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to add suppression',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/deliverability/check-lead
 * Enhanced lead checking with validation and suppression
 */
const checkLeadSchema = z.object({
  email: z.string().email('Invalid email address')
});

router.post('/check-lead',
  validateRequest({ body: checkLeadSchema }),
  async (req, res) => {
    try {
      const { email } = req.body;
      
      // Enhanced email validation
      const validation = EnhancedEmailValidator.validateEmail(email);
      
      // Check existing suppression system
      const allLeads = await storage.getLeads();
      const lead = allLeads.find(l => l.email === email);
      
      const legacySuppressed = SuppressionManager.isSuppressed(lead ? { 
        tags: lead.tags || undefined, 
        status: lead.status || undefined 
      } : { status: 'not_found' });
      
      // Combined suppression check
      const suppressed = legacySuppressed || !validation.isValid;
      
      res.json({
        email,
        validation,
        legacySuppressed,
        enhancedSuppressed: !validation.isValid,
        suppressed,
        canSend: !suppressed,
        reason: suppressed ? (validation.reason || lead?.status || 'unknown') : null,
        leadExists: !!lead
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to check lead status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;