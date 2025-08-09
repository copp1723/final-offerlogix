import { Router } from "express";
import { conversationIntelligenceHub } from "../services/conversation-intelligence-hub";
import { enhancedConversationAI } from "../services/enhanced-conversation-ai";
import { intelligentResponseRouter } from "../services/intelligent-response-router";
import { advancedConversationAnalytics } from "../services/advanced-conversation-analytics";
import { responseQualityOptimizer } from "../services/response-quality-optimizer";
import { storage } from "../storage";

const router = Router();

/**
 * Conversation Intelligence API Routes
 * 
 * Provides REST API endpoints for all conversation intelligence features:
 * - Main conversation processing pipeline
 * - Enhanced AI response generation
 * - Intelligent routing decisions
 * - Advanced analytics and insights
 * - Response quality optimization
 * - A/B testing for responses
 */

// =============================================================================
// Main Conversation Processing Pipeline
// =============================================================================

/**
 * Process a new conversation message with full intelligence pipeline
 * POST /api/conversation-intelligence/process
 */
router.post("/process", async (req, res) => {
  try {
    const { conversationId, message, senderId } = req.body;
    
    if (!conversationId || !message || !senderId) {
      return res.status(400).json({ 
        error: "Missing required fields: conversationId, message, senderId" 
      });
    }

    const result = await conversationIntelligenceHub.processConversation(
      conversationId,
      message,
      senderId
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Conversation processing error:', error);
    res.status(500).json({ 
      error: "Failed to process conversation",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get comprehensive conversation insights
 * GET /api/conversation-intelligence/insights/:conversationId
 */
router.get("/insights/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const insights = await conversationIntelligenceHub.getConversationInsights(conversationId);
    
    res.json({
      success: true,
      data: insights
    });

  } catch (error) {
    console.error('Conversation insights error:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ 
        error: "Failed to get conversation insights",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
});

/**
 * Get conversation metrics and analytics
 * GET /api/conversation-intelligence/metrics
 */
router.get("/metrics", async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const timeframe = {
      start: start ? new Date(start as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: end ? new Date(end as string) : new Date()
    };

    const metrics = await conversationIntelligenceHub.getConversationMetrics(timeframe);
    
    res.json({
      success: true,
      data: metrics,
      timeframe
    });

  } catch (error) {
    console.error('Conversation metrics error:', error);
    res.status(500).json({ 
      error: "Failed to get conversation metrics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Analyze multiple conversations in batch
 * POST /api/conversation-intelligence/batch-analyze
 */
router.post("/batch-analyze", async (req, res) => {
  try {
    const { conversationIds } = req.body;
    
    if (!conversationIds || !Array.isArray(conversationIds)) {
      return res.status(400).json({ 
        error: "conversationIds array is required" 
      });
    }

    const results = await conversationIntelligenceHub.analyzeConversationBatch(conversationIds);
    
    res.json({
      success: true,
      data: results,
      processedCount: results.length
    });

  } catch (error) {
    console.error('Batch conversation analysis error:', error);
    res.status(500).json({ 
      error: "Failed to analyze conversations",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get real-time coaching recommendations
 * GET /api/conversation-intelligence/coaching/:conversationId
 */
router.get("/coaching/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const coaching = await conversationIntelligenceHub.getRealtimeCoaching(conversationId);
    
    res.json({
      success: true,
      data: coaching
    });

  } catch (error) {
    console.error('Real-time coaching error:', error);
    res.status(500).json({ 
      error: "Failed to get coaching recommendations",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get conversation intelligence dashboard data
 * GET /api/conversation-intelligence/dashboard
 */
router.get("/dashboard", async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const timeframe = {
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      end: end ? new Date(end as string) : new Date()
    };

    const dashboardData = await conversationIntelligenceHub.getDashboardData(timeframe);
    
    res.json({
      success: true,
      data: dashboardData,
      timeframe
    });

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({ 
      error: "Failed to get dashboard data",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =============================================================================
// Enhanced Conversation AI Routes
// =============================================================================

/**
 * Generate enhanced AI response
 * POST /api/conversation-intelligence/ai/generate-response
 */
router.post("/ai/generate-response", async (req, res) => {
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

    const lead = await storage.getLead(conversation.leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const conversationHistory = await storage.getConversationMessages(conversationId);
    
    // This would use the conversation intelligence hub to build full context
    const context = {
      leadId: conversation.leadId,
      conversationId,
      leadProfile: lead,
      conversationHistory,
      currentAnalysis: { 
        mood: 'neutral' as const,
        urgency: 'medium' as const,
        intent: 'information_seeking' as const,
        buyingSignals: [],
        riskFactors: [],
        recommendedAction: 'continue' as const,
        confidence: 70,
        nextSteps: []
      },
      leadScore: 70,
      priority: 'warm' as const,
      previousResponses: []
    };

    const response = await enhancedConversationAI.generateContextAwareResponse(
      context,
      message,
      options || {}
    );
    
    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('AI response generation error:', error);
    res.status(500).json({ 
      error: "Failed to generate AI response",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get conversation suggestions for agents
 * GET /api/conversation-intelligence/ai/suggestions/:conversationId
 */
router.get("/ai/suggestions/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Build context (simplified version)
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const context = {
      // Simplified context for suggestions
      conversationId,
      leadId: conversation.leadId,
      leadProfile: await storage.getLead(conversation.leadId),
      conversationHistory: await storage.getConversationMessages(conversationId),
      currentAnalysis: {
        mood: 'neutral' as const,
        urgency: 'medium' as const,
        intent: 'information_seeking' as const,
        buyingSignals: [],
        riskFactors: [],
        recommendedAction: 'continue' as const,
        confidence: 70,
        nextSteps: []
      },
      leadScore: 70,
      priority: 'warm' as const,
      previousResponses: []
    };

    const suggestions = await enhancedConversationAI.getConversationSuggestions(context);
    
    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Conversation suggestions error:', error);
    res.status(500).json({ 
      error: "Failed to get conversation suggestions",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =============================================================================
// Intelligent Response Routing Routes
// =============================================================================

/**
 * Get routing decision for a message
 * POST /api/conversation-intelligence/routing/decision
 */
router.post("/routing/decision", async (req, res) => {
  try {
    const { conversationId, message, senderId } = req.body;
    
    if (!conversationId || !message || !senderId) {
      return res.status(400).json({ 
        error: "conversationId, message, and senderId are required" 
      });
    }

    const routingResult = await intelligentResponseRouter.routeConversation(
      conversationId,
      message,
      senderId
    );
    
    res.json({
      success: true,
      data: routingResult
    });

  } catch (error) {
    console.error('Routing decision error:', error);
    res.status(500).json({ 
      error: "Failed to get routing decision",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get routing performance metrics
 * GET /api/conversation-intelligence/routing/metrics
 */
router.get("/routing/metrics", async (req, res) => {
  try {
    const metrics = intelligentResponseRouter.getRoutingMetrics();
    
    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('Routing metrics error:', error);
    res.status(500).json({ 
      error: "Failed to get routing metrics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get conversation flow state
 * GET /api/conversation-intelligence/routing/flow/:conversationId
 */
router.get("/routing/flow/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const flowState = intelligentResponseRouter.getConversationFlow(conversationId);
    
    if (!flowState) {
      return res.status(404).json({ 
        error: "Conversation flow not found" 
      });
    }
    
    res.json({
      success: true,
      data: flowState
    });

  } catch (error) {
    console.error('Conversation flow error:', error);
    res.status(500).json({ 
      error: "Failed to get conversation flow",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =============================================================================
// Advanced Conversation Analytics Routes
// =============================================================================

/**
 * Analyze sentiment progression
 * GET /api/conversation-intelligence/analytics/sentiment/:conversationId
 */
router.get("/analytics/sentiment/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const sentimentProgression = await advancedConversationAnalytics.analyzeSentimentProgression(conversationId);
    
    res.json({
      success: true,
      data: sentimentProgression
    });

  } catch (error) {
    console.error('Sentiment analysis error:', error);
    res.status(500).json({ 
      error: "Failed to analyze sentiment progression",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Enhanced intent classification
 * POST /api/conversation-intelligence/analytics/intent/:conversationId
 */
router.post("/analytics/intent/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { messageId } = req.body;
    
    const intentClassification = await advancedConversationAnalytics.classifyIntentEnhanced(
      conversationId,
      messageId
    );
    
    res.json({
      success: true,
      data: intentClassification
    });

  } catch (error) {
    console.error('Intent classification error:', error);
    res.status(500).json({ 
      error: "Failed to classify intent",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Analyze buying signals
 * GET /api/conversation-intelligence/analytics/buying-signals/:conversationId
 */
router.get("/analytics/buying-signals/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const buyingSignalAnalysis = await advancedConversationAnalytics.analyzeBuyingSignals(conversationId);
    
    res.json({
      success: true,
      data: buyingSignalAnalysis
    });

  } catch (error) {
    console.error('Buying signals analysis error:', error);
    res.status(500).json({ 
      error: "Failed to analyze buying signals",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Predict conversation outcomes
 * GET /api/conversation-intelligence/analytics/prediction/:conversationId
 */
router.get("/analytics/prediction/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const prediction = await advancedConversationAnalytics.predictConversationOutcome(conversationId);
    
    res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    console.error('Conversation prediction error:', error);
    res.status(500).json({ 
      error: "Failed to predict conversation outcome",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Generate coaching suggestions
 * GET /api/conversation-intelligence/analytics/coaching/:conversationId
 */
router.get("/analytics/coaching/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const suggestions = await advancedConversationAnalytics.generateCoachingSuggestions(conversationId);
    
    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Coaching suggestions error:', error);
    res.status(500).json({ 
      error: "Failed to generate coaching suggestions",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Calculate conversation quality metrics
 * GET /api/conversation-intelligence/analytics/quality/:conversationId
 */
router.get("/analytics/quality/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const qualityMetrics = await advancedConversationAnalytics.calculateConversationQuality(conversationId);
    
    res.json({
      success: true,
      data: qualityMetrics
    });

  } catch (error) {
    console.error('Quality metrics error:', error);
    res.status(500).json({ 
      error: "Failed to calculate conversation quality",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =============================================================================
// Response Quality Optimization Routes
// =============================================================================

/**
 * Create A/B test for response optimization
 * POST /api/conversation-intelligence/optimization/ab-test
 */
router.post("/optimization/ab-test", async (req, res) => {
  try {
    const { name, description, variants, targetSegment } = req.body;
    
    if (!name || !description || !variants || !Array.isArray(variants)) {
      return res.status(400).json({ 
        error: "name, description, and variants array are required" 
      });
    }

    const testId = await conversationIntelligenceHub.createConversationABTest(
      name,
      description,
      variants,
      targetSegment
    );
    
    res.json({
      success: true,
      data: { testId },
      message: "A/B test created successfully"
    });

  } catch (error) {
    console.error('A/B test creation error:', error);
    res.status(500).json({ 
      error: "Failed to create A/B test",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Start an A/B test
 * POST /api/conversation-intelligence/optimization/ab-test/:testId/start
 */
router.post("/optimization/ab-test/:testId/start", async (req, res) => {
  try {
    const { testId } = req.params;
    
    await responseQualityOptimizer.startABTest(testId);
    
    res.json({
      success: true,
      message: "A/B test started successfully"
    });

  } catch (error) {
    console.error('A/B test start error:', error);
    res.status(500).json({ 
      error: "Failed to start A/B test",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get active A/B tests
 * GET /api/conversation-intelligence/optimization/ab-tests
 */
router.get("/optimization/ab-tests", async (req, res) => {
  try {
    const activeTests = responseQualityOptimizer.getActiveABTests();
    
    res.json({
      success: true,
      data: activeTests
    });

  } catch (error) {
    console.error('A/B tests retrieval error:', error);
    res.status(500).json({ 
      error: "Failed to get A/B tests",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get response effectiveness scores
 * GET /api/conversation-intelligence/optimization/effectiveness
 */
router.get("/optimization/effectiveness", async (req, res) => {
  try {
    const { limit } = req.query;
    
    const scores = responseQualityOptimizer.getResponseScores(
      limit ? parseInt(limit as string) : 100
    );
    
    res.json({
      success: true,
      data: scores
    });

  } catch (error) {
    console.error('Response effectiveness error:', error);
    res.status(500).json({ 
      error: "Failed to get response effectiveness scores",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Generate optimization recommendations
 * GET /api/conversation-intelligence/optimization/recommendations
 */
router.get("/optimization/recommendations", async (req, res) => {
  try {
    const { start, end, leadSegment } = req.query;
    
    const timeframe = {
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: end ? new Date(end as string) : new Date()
    };

    const recommendations = await responseQualityOptimizer.generateOptimizationRecommendations(
      timeframe,
      leadSegment as string
    );
    
    res.json({
      success: true,
      data: recommendations,
      timeframe
    });

  } catch (error) {
    console.error('Optimization recommendations error:', error);
    res.status(500).json({ 
      error: "Failed to generate optimization recommendations",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get personalization profiles
 * GET /api/conversation-intelligence/optimization/personalization
 */
router.get("/optimization/personalization", async (req, res) => {
  try {
    const profiles = responseQualityOptimizer.getPersonalizationProfiles();
    
    res.json({
      success: true,
      data: profiles
    });

  } catch (error) {
    console.error('Personalization profiles error:', error);
    res.status(500).json({ 
      error: "Failed to get personalization profiles",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Optimize personalization for a lead segment
 * POST /api/conversation-intelligence/optimization/personalization/:segment
 */
router.post("/optimization/personalization/:segment", async (req, res) => {
  try {
    const { segment } = req.params;
    
    const optimization = await responseQualityOptimizer.optimizePersonalization(segment);
    
    res.json({
      success: true,
      data: optimization,
      message: "Personalization optimized successfully"
    });

  } catch (error) {
    console.error('Personalization optimization error:', error);
    res.status(500).json({ 
      error: "Failed to optimize personalization",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Monitor quality metrics
 * GET /api/conversation-intelligence/optimization/quality-monitoring
 */
router.get("/optimization/quality-monitoring", async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const timeframe = {
      start: start ? new Date(start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      end: end ? new Date(end as string) : new Date()
    };

    const monitoring = await responseQualityOptimizer.monitorQualityMetrics(timeframe);
    
    res.json({
      success: true,
      data: monitoring,
      timeframe
    });

  } catch (error) {
    console.error('Quality monitoring error:', error);
    res.status(500).json({ 
      error: "Failed to monitor quality metrics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Get response analytics
 * GET /api/conversation-intelligence/optimization/analytics
 */
router.get("/optimization/analytics", async (req, res) => {
  try {
    const { start, end } = req.query;
    
    const timeframe = {
      start: start ? new Date(start as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      end: end ? new Date(end as string) : new Date()
    };

    const analytics = await responseQualityOptimizer.getResponseAnalytics(timeframe);
    
    res.json({
      success: true,
      data: analytics,
      timeframe
    });

  } catch (error) {
    console.error('Response analytics error:', error);
    res.status(500).json({ 
      error: "Failed to get response analytics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// =============================================================================
// Service Health and Management Routes
// =============================================================================

/**
 * Get service health status
 * GET /api/conversation-intelligence/health
 */
router.get("/health", async (req, res) => {
  try {
    const health = conversationIntelligenceHub.getServiceHealth();
    
    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    console.error('Service health error:', error);
    res.status(500).json({ 
      error: "Failed to get service health",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Clear processing cache
 * POST /api/conversation-intelligence/cache/clear
 */
router.post("/cache/clear", async (req, res) => {
  try {
    const { olderThan } = req.body;
    
    conversationIntelligenceHub.clearCache(
      olderThan ? new Date(olderThan) : undefined
    );
    
    res.json({
      success: true,
      message: "Cache cleared successfully"
    });

  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ 
      error: "Failed to clear cache",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Update A/B test results
 * POST /api/conversation-intelligence/optimization/ab-test/:testId/results
 */
router.post("/optimization/ab-test/:testId/results", async (req, res) => {
  try {
    const { testId } = req.params;
    const results = req.body;
    
    if (!results.variantId) {
      return res.status(400).json({ 
        error: "variantId is required in results" 
      });
    }

    await responseQualityOptimizer.updateABTestResults(testId, results);
    
    res.json({
      success: true,
      message: "A/B test results updated successfully"
    });

  } catch (error) {
    console.error('A/B test results update error:', error);
    res.status(500).json({ 
      error: "Failed to update A/B test results",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * Update template effectiveness
 * POST /api/conversation-intelligence/routing/template/:templateId/effectiveness
 */
router.post("/routing/template/:templateId/effectiveness", async (req, res) => {
  try {
    const { templateId } = req.params;
    const { effectiveness } = req.body;
    
    if (typeof effectiveness !== 'number' || effectiveness < 0 || effectiveness > 100) {
      return res.status(400).json({ 
        error: "effectiveness must be a number between 0 and 100" 
      });
    }

    await intelligentResponseRouter.updateTemplateEffectiveness(templateId, effectiveness);
    
    res.json({
      success: true,
      message: "Template effectiveness updated successfully"
    });

  } catch (error) {
    console.error('Template effectiveness update error:', error);
    res.status(500).json({ 
      error: "Failed to update template effectiveness",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;