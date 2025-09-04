import { Router } from 'express';
import OpenAI from 'openai';
import { OfferLogixCreditService, type CreditApplication } from '../services/offerlogix-credit';
import { OfferLogixConversationService } from '../services/offerlogix-conversation';
import { z } from 'zod';

const router = Router();

// Initialize services
const creditService = new OfferLogixCreditService();
const conversationService = new OfferLogixConversationService();

// Validation schemas
const CreditApplicationSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string(),
  creditScore: z.number().optional(),
  creditTier: z.enum(['excellent', 'good', 'fair', 'challenged']).optional(),
  monthlyIncome: z.number(),
  monthlyExpenses: z.number().optional(),
  employmentStatus: z.enum(['employed', 'self_employed', 'retired', 'other']),
  employmentDuration: z.string().optional(),
  vehiclePrice: z.number(),
  downPayment: z.number(),
  tradeInValue: z.number().optional(),
  requestedTerm: z.number(),
  housingStatus: z.enum(['own', 'rent', 'other']),
  bankruptcy: z.boolean().optional(),
  coApplicant: z.boolean().optional()
});

const PreQualificationSchema = z.object({
  creditTier: z.string(),
  income: z.number(),
  vehiclePrice: z.number()
});

const ConversationSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  customerId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * POST /api/offerlogix/credit/instant-decision
 * Process instant credit decision
 */
router.post('/credit/instant-decision', async (req, res) => {
  try {
    const application = CreditApplicationSchema.parse(req.body);
    
    // Initialize OpenAI client (use environment variable or default)
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY
    });
    
    const decision = await creditService.processInstantDecision(
      application as CreditApplication,
      openaiClient
    );
    
    res.json({
      success: true,
      data: decision
    });
  } catch (error) {
    console.error('Instant decision error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid application data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process credit decision'
    });
  }
});

/**
 * POST /api/offerlogix/credit/pre-qualify
 * Get pre-qualification without full application
 */
router.post('/credit/pre-qualify', async (req, res) => {
  try {
    const { creditTier, income, vehiclePrice } = PreQualificationSchema.parse(req.body);
    
    const result = await creditService.getPreQualification(
      creditTier,
      income,
      vehiclePrice
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Pre-qualification error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pre-qualification data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process pre-qualification'
    });
  }
});

/**
 * POST /api/offerlogix/conversation/message
 * Process conversation message
 */
router.post('/conversation/message', async (req, res) => {
  try {
    const { sessionId, message, customerId, metadata } = ConversationSchema.parse(req.body);
    
    // Initialize OpenAI client
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.API_KEY
    });
    
    // Update customer ID if provided
    if (customerId) {
      conversationService.updateCustomerProfile(sessionId, { 
        vehicleInterest: metadata?.vehicleInterest,
        budget: metadata?.budget,
        creditTier: metadata?.creditTier,
        timeline: metadata?.timeline
      });
    }
    
    const response = await conversationService.processMessage(
      sessionId,
      message,
      openaiClient
    );
    
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Conversation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

/**
 * GET /api/offerlogix/conversation/summary/:sessionId
 * Get conversation summary
 */
router.get('/conversation/summary/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const summary = conversationService.getConversationSummary(sessionId);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Summary error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation summary'
    });
  }
});

/**
 * DELETE /api/offerlogix/conversation/:sessionId
 * Clear conversation context
 */
router.delete('/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    conversationService.clearContext(sessionId);
    
    res.json({
      success: true,
      message: 'Conversation cleared'
    });
  } catch (error) {
    console.error('Clear conversation error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation'
    });
  }
});

export default router;