/**
 * AI Conversation API Routes
 * Enhanced conversation endpoints with memory-augmented replies and quality scoring
 */

import { Router } from 'express';
import { storage } from '../storage';
import { validateRequest } from '../middleware/validation';
import { z } from 'zod';
import { planReply, quickReplies, scoreReplyQuality, needsClarification, clarificationPrompt } from '../services/ai/replyPlanner';
import { MemoryMapper } from '../integrations/supermemory';

const router = Router();

/**
 * POST /api/ai/plan-reply
 * Generate memory-augmented reply for lead conversation
 */
const planReplySchema = z.object({
  lead: z.object({
    id: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    vehicleInterest: z.string().optional(),
    clientId: z.string()
  }),
  lastUserMsg: z.string().min(1, 'Message is required'),
  campaign: z.object({
    id: z.string(),
    name: z.string(),
    context: z.string().optional()
  }).optional()
});

router.post('/plan-reply',
  validateRequest({ body: planReplySchema }),
  async (req, res) => {
    try {
      const input = req.body;
      
      // Check if clarification is needed
      const memoryHitCount = 3; // Would come from actual memory search
      if (needsClarification(input.lastUserMsg, memoryHitCount)) {
        const clarification = clarificationPrompt(input.lastUserMsg);
        return res.json({
          reply: clarification,
          needsClarification: true,
          confidence: 'low'
        });
      }
      
      const reply = await planReply(input);
      const qualityScore = scoreReplyQuality(reply);
      
      // Store reply in memory for future context
      await MemoryMapper.writeLeadMessage({
        type: 'lead_msg',
        clientId: input.lead.clientId,
        campaignId: input.campaign?.id,
        leadEmail: input.lead.email,
        content: `AI Reply: ${reply}`,
        meta: { 
          qualityScore,
          vehicleInterest: input.lead.vehicleInterest,
          timestamp: new Date().toISOString()
        }
      });
      
      res.json({
        reply,
        qualityScore,
        confidence: qualityScore > 25 ? 'high' : 'medium',
        needsClarification: false
      });
      
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/ai/quick-replies
 * Generate quick reply suggestions for conversation
 */
const quickRepliesSchema = z.object({
  lastUserMsg: z.string().min(1, 'Message is required'),
  vehicle: z.string().optional()
});

router.post('/quick-replies',
  validateRequest({ body: quickRepliesSchema }),
  async (req, res) => {
    try {
      const { lastUserMsg, vehicle } = req.body;
      const replies = await quickReplies({ lastUserMsg, vehicle });
      
      res.json({
        suggestions: replies,
        count: replies.length
      });
      
    } catch (error) {
      res.status(500).json({
        error: 'Failed to generate quick replies',
        details: error instanceof Error ? error.message : 'Unknown error',
        fallback: ['Tell me more', 'Schedule test drive', 'Get pricing info']
      });
    }
  }
);

/**
 * POST /api/ai/score-reply
 * Score reply quality using heuristics
 */
const scoreReplySchema = z.object({
  message: z.string().min(1, 'Message is required')
});

router.post('/score-reply',
  validateRequest({ body: scoreReplySchema }),
  async (req, res) => {
    try {
      const { message } = req.body;
      const score = scoreReplyQuality(message);
      
      res.json({
        score,
        maxScore: 40,
        quality: score > 30 ? 'excellent' : score > 20 ? 'good' : score > 10 ? 'fair' : 'poor',
        recommendations: score < 20 ? [
          'Include a clear call-to-action',
          'Keep message under 700 characters',
          'Use relational tone (you/we)',
          'Avoid unnecessary apologies'
        ] : []
      });
      
    } catch (error) {
      res.status(500).json({
        error: 'Failed to score reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * POST /api/ai/store-intent
 * Store structured intent nugget in memory
 */
const storeIntentSchema = z.object({
  leadId: z.string(),
  clientId: z.string(),
  campaignId: z.string().optional(),
  userMsg: z.string(),
  intent: z.enum(['price_focus', 'features_focus', 'timing_focus', 'comparison_focus', 'ready_to_buy'])
});

router.post('/store-intent',
  validateRequest({ body: storeIntentSchema }),
  async (req, res) => {
    try {
      const { leadId, clientId, campaignId, userMsg, intent } = req.body;
      
      await MemoryMapper.writeLeadMessage({
        type: 'lead_msg',
        clientId,
        campaignId,
        leadEmail: `lead_${leadId}`, // Would resolve actual email
        content: `Lead intent: ${intent} | "${userMsg}"`,
        meta: { 
          intent,
          leadId,
          timestamp: new Date().toISOString()
        }
      });
      
      res.json({
        success: true,
        message: 'Intent nugget stored successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        error: 'Failed to store intent',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;