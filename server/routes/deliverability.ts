/**
 * Deliverability API Routes
 * Endpoints for domain health, suppression management, and email quality monitoring
 */

import { Router } from 'express';
import { DomainHealthGuard } from '../services/deliverability/DomainHealthGuard';
import { SuppressionManager } from '../services/deliverability/SuppressionManager';
import { storage } from '../storage';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/deliverability/health
 * Check domain authentication and deliverability health
 */
router.get('/health', async (req, res) => {
  try {
    await DomainHealthGuard.assertAuthReady();
    const health = await DomainHealthGuard.checkDeliverabilityHealth();
    
    res.json({
      status: 'healthy',
      ...health,
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
 * Remove email from suppression list
 */
const removeSuppressionSchema = z.object({
  email: z.string().email('Invalid email address')
});

router.post('/suppressions/remove', 
  validateRequest({ body: removeSuppressionSchema }),
  async (req, res) => {
    try {
      const { email } = req.body;
      await SuppressionManager.removeSuppression(email);
      
      res.json({
        success: true,
        message: `Suppression removed for ${email}`
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
 * Check if a lead is suppressed before sending
 */
const checkLeadSchema = z.object({
  email: z.string().email('Invalid email address')
});

router.post('/check-lead',
  validateRequest({ body: checkLeadSchema }),
  async (req, res) => {
    try {
      const { email } = req.body;
      const allLeads = await storage.getLeads();
      const lead = allLeads.find(l => l.email === email);
      
      const suppressed = SuppressionManager.isSuppressed(lead ? { 
        tags: lead.tags || undefined, 
        status: lead.status || undefined 
      } : { status: 'not_found' });
      
      res.json({
        email,
        suppressed,
        reason: suppressed ? (lead?.status || 'unknown') : null,
        canSend: !suppressed
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