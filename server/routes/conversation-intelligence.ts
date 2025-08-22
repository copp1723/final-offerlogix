import { Router } from "express";
import { enhancedConversationAI, type ConversationContext } from "../services/enhanced-conversation-ai";
import { intelligentResponseRouter } from "../services/intelligent-response-router";
import { storage } from "../storage";

const router = Router();

/**
 * Simplified Conversation Intelligence API Routes
 * 
 * Core features only:
 * - Context-aware response generation
 * - Escalation triggers and smart handover
 * - Basic conversation processing
 */

// =============================================================================
// Core Conversation Processing
// =============================================================================

/**
 * Generate context-aware AI response
 * POST /api/conversation-intelligence/generate-response
 */
router.post("/generate-response", async (req, res) => {
  try {
    const { conversationId, message, options } = req.body;
    
    if (!conversationId || !message) {
      return res.status(400).json({ 
        error: "conversationId and message are required" 
      });
    }

    // Build conversation context
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (!conversation.leadId) {
      return res.status(400).json({ error: "Conversation has no associated lead" });
    }

    const leadId = conversation.leadId;
    const lead = await storage.getLead(leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const conversationHistory = await storage.getConversationMessages(conversationId);

    const context: ConversationContext = {
      leadId,
      conversationId,
      leadProfile: lead as any,
      conversationHistory: conversationHistory as any,
      currentAnalysis: {
        conversationId,
        leadId,
        mood: 'neutral' as const,
        urgency: 'medium' as const,
        intent: 'research' as const,
        buyingSignals: [],
        nextBestActions: [],
        escalationRecommended: false,
        confidence: 0.8
      },
      leadScore: 0,
      priority: 'warm' as const,
      previousResponses: conversationHistory.map(msg => msg.content || '').filter(Boolean)
    };

    // Generate enhanced response with context awareness
    const response = await enhancedConversationAI.generateContextAwareResponse(context, options || {});
    
    res.json({
      success: true,
      data: {
        response: response.content,
        escalationRecommended: response.escalationRecommended,
        buyingSignalsDetected: response.buyingSignalsDetected,
        confidence: response.confidence,
        nextStepSuggestions: response.nextStepSuggestions
      }
    });

  } catch (error) {
    console.error('Response generation error:', error);
    res.status(500).json({ 
      error: "Failed to generate response",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Check if conversation needs escalation
 * POST /api/conversation-intelligence/check-escalation
 */
router.post("/check-escalation", async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    
    if (!conversationId || !message) {
      return res.status(400).json({ 
        error: "conversationId and message are required" 
      });
    }

    // Use intelligent response router to check for escalation triggers
    const routingResult = await intelligentResponseRouter.routeConversation(
      conversationId,
      message,
      'lead' // senderId
    );

    const needsEscalation = routingResult.routingDecision.routingType === 'human_escalation';
    
    res.json({
      success: true,
      data: {
        needsEscalation,
        escalationReason: routingResult.routingDecision.escalationReason,
        priority: routingResult.routingDecision.priority,
        suggestedActions: routingResult.routingDecision.requiredActions || []
      }
    });

  } catch (error) {
    console.error('Escalation check error:', error);
    res.status(500).json({ 
      error: "Failed to check escalation",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get conversation context for AI processing
 * GET /api/conversation-intelligence/context/:conversationId
 */
router.get("/context/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (!conversation.leadId) {
      return res.status(400).json({ error: "Conversation has no associated lead" });
    }

    const lead = await storage.getLead(conversation.leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const conversationHistory = await storage.getConversationMessages(conversationId);
    
    res.json({
      success: true,
      data: {
        conversationId,
        leadId: conversation.leadId,
        leadProfile: {
          name: (lead as any).name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'Unknown',
          email: lead.email,
          phone: lead.phone,
          company: (lead as any).company || 'Unknown'
        },
        messageCount: conversationHistory.length,
        lastActivity: conversationHistory[conversationHistory.length - 1]?.createdAt || conversation.createdAt
      }
    });

  } catch (error) {
    console.error('Context retrieval error:', error);
    res.status(500).json({ 
      error: "Failed to get conversation context",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export { router as conversationIntelligenceRouter };