import { Router } from 'express';
import { conversationStateManager, ConversationEvent, ConversationState } from '../services/conversation-state/ConversationStateManager';
import { leadJourneyTracker } from '../services/conversation-state/LeadJourneyTracker';
import { messageThreadingService } from '../services/conversation-state/MessageThreadingService';
import { conversationValidator } from '../services/conversation-state/ConversationValidator';
import { conversationIntegrationManager } from '../services/conversation-state/ConversationIntegrationManager';
import { webSocketService } from '../services/websocket';
import { storage } from '../storage';

const router = Router();

/**
 * GET /api/conversation-state/:conversationId/status
 * Get current conversation state and analytics
 */
router.get('/:conversationId/status', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const analytics = await conversationStateManager.getConversationAnalytics(conversationId);
    const integrationStatus = await conversationIntegrationManager.getIntegrationStatus(conversationId);
    
    res.json({
      conversationId,
      currentState: conversation.status,
      analytics,
      integrationStatus,
      lastUpdated: conversation.updatedAt
    });
  } catch (error) {
    console.error('Failed to get conversation status:', error);
    res.status(500).json({ error: 'Failed to get conversation status' });
  }
});

/**
 * POST /api/conversation-state/:conversationId/transition
 * Manually trigger state transition
 */
router.post('/:conversationId/transition', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { event, triggeredBy, metadata } = req.body;

    if (!event || !triggeredBy) {
      return res.status(400).json({ error: 'Event and triggeredBy are required' });
    }

    // Validate event is valid ConversationEvent
    if (!Object.values(ConversationEvent).includes(event)) {
      return res.status(400).json({ error: 'Invalid conversation event' });
    }

    const success = await conversationStateManager.transitionState(
      conversationId,
      event as ConversationEvent,
      triggeredBy,
      metadata
    );

    if (success) {
      const updatedConversation = await storage.getConversation(conversationId);
      res.json({
        success: true,
        conversationId,
        newState: updatedConversation?.status,
        event,
        triggeredBy,
        timestamp: new Date()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'State transition failed - check validation requirements'
      });
    }
  } catch (error) {
    console.error('Failed to transition state:', error);
    res.status(500).json({ error: 'Failed to transition conversation state' });
  }
});

/**
 * GET /api/conversation-state/:conversationId/lead-journey
 * Get lead journey information
 */
router.get('/:conversationId/lead-journey', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const conversation = await storage.getConversation(conversationId);
    if (!conversation || !conversation.leadId) {
      return res.status(404).json({ error: 'Conversation or lead not found' });
    }

    const progress = await leadJourneyTracker.getLeadProgress(conversation.leadId);
    const dashboard = await leadJourneyTracker.getLeadJourneyDashboard(conversation.leadId);
    
    res.json({
      conversationId,
      leadId: conversation.leadId,
      progress,
      dashboard
    });
  } catch (error) {
    console.error('Failed to get lead journey:', error);
    res.status(500).json({ error: 'Failed to get lead journey' });
  }
});

/**
 * GET /api/conversation-state/:conversationId/thread-tree
 * Get conversation message thread tree
 */
router.get('/:conversationId/thread-tree', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const threadTree = await messageThreadingService.getConversationThreadTree(conversationId);
    
    if (!threadTree) {
      return res.status(404).json({ error: 'Conversation thread not found' });
    }

    res.json(threadTree);
  } catch (error) {
    console.error('Failed to get thread tree:', error);
    res.status(500).json({ error: 'Failed to get conversation thread tree' });
  }
});

/**
 * GET /api/conversation-state/:conversationId/context
 * Get full conversation context
 */
router.get('/:conversationId/context', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const context = await messageThreadingService.getConversationContext(conversationId);
    
    res.json({
      conversationId,
      context,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to get conversation context:', error);
    res.status(500).json({ error: 'Failed to get conversation context' });
  }
});

/**
 * POST /api/conversation-state/:conversationId/validate-transition
 * Validate a potential state transition without executing it
 */
router.post('/:conversationId/validate-transition', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { fromState, toState, event, triggeredBy, metadata } = req.body;

    if (!fromState || !toState || !event || !triggeredBy) {
      return res.status(400).json({ error: 'fromState, toState, event, and triggeredBy are required' });
    }

    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const validationResult = await conversationValidator.validateTransition({
      conversationId,
      leadId: conversation.leadId ?? undefined,
      fromState: fromState as ConversationState,
      toState: toState as ConversationState,
      event: event as ConversationEvent,
      metadata,
      triggeredBy
    });

    res.json({
      conversationId,
      validation: validationResult,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to validate transition:', error);
    res.status(500).json({ error: 'Failed to validate state transition' });
  }
});

/**
 * GET /api/conversation-state/validation-rules
 * Get all validation rules
 */
router.get('/validation-rules', async (req, res) => {
  try {
    const rules = conversationValidator.getValidationRules();
    res.json({
      rules: rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        fromState: rule.fromState,
        toState: rule.toState,
        event: rule.event,
        required: rule.required
      }))
    });
  } catch (error) {
    console.error('Failed to get validation rules:', error);
    res.status(500).json({ error: 'Failed to get validation rules' });
  }
});

/**
 * POST /api/conversation-state/:conversationId/process-message
 * Process a new message through the threading system
 */
router.post('/:conversationId/process-message', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { senderId, content, messageType, isFromAI, emailHeaders } = req.body;

    if (!senderId || !content || !messageType || isFromAI === undefined) {
      return res.status(400).json({ error: 'senderId, content, messageType, and isFromAI are required' });
    }

    const threadedMessage = await messageThreadingService.processMessage(
      conversationId,
      senderId,
      content,
      messageType,
      isFromAI,
      emailHeaders
    );

    // Broadcast message update
    webSocketService.broadcastMessageThreadUpdate(conversationId, {
      message: threadedMessage,
      action: 'message_added'
    });

    res.json({
      success: true,
      message: threadedMessage,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to process message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * POST /api/conversation-state/:conversationId/integration-event
 * Process an integration event (email delivery, handover, etc.)
 */
router.post('/:conversationId/integration-event', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { type, metadata, source, leadId } = req.body;

    if (!type || !source) {
      return res.status(400).json({ error: 'Event type and source are required' });
    }

    const integrationEvent = conversationIntegrationManager.createIntegrationEvent(
      type,
      conversationId,
      metadata || {},
      source,
      leadId
    );

    const success = await conversationIntegrationManager.processIntegrationEvent(integrationEvent);

    res.json({
      success,
      event: integrationEvent,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to process integration event:', error);
    res.status(500).json({ error: 'Failed to process integration event' });
  }
});

/**
 * GET /api/conversation-state/:conversationId/metrics
 * Get conversation metrics and analytics
 */
router.get('/:conversationId/metrics', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const metrics = await conversationStateManager.updateConversationMetrics(conversationId);
    
    if (!metrics) {
      return res.status(404).json({ error: 'Conversation metrics not found' });
    }

    res.json({
      conversationId,
      metrics,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to get conversation metrics:', error);
    res.status(500).json({ error: 'Failed to get conversation metrics' });
  }
});

/**
 * GET /api/conversation-state/lead/:leadId/journey
 * Get complete lead journey across all conversations
 */
router.get('/lead/:leadId/journey', async (req, res) => {
  try {
    const { leadId } = req.params;
    
    const journey = await leadJourneyTracker.getLeadJourney(leadId);
    
    if (!journey) {
      return res.status(404).json({ error: 'Lead journey not found' });
    }

    res.json({
      leadId,
      journey,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Failed to get lead journey:', error);
    res.status(500).json({ error: 'Failed to get lead journey' });
  }
});

/**
 * GET /api/conversation-state/dashboard/overview
 * Get dashboard overview of all conversation states
 */
router.get('/dashboard/overview', async (req, res) => {
  try {
    const conversations = await storage.getConversations();
    
    const overview = {
      totalConversations: conversations.length,
      stateDistribution: {} as Record<string, number>,
      recentActivity: [] as any[],
      metrics: {
        averageTimeToResponse: 0,
        conversionRate: 0,
        engagementScore: 0
      }
    };

    // Calculate state distribution
    conversations.forEach(conv => {
      const state = conv.status || 'unknown';
      overview.stateDistribution[state] = (overview.stateDistribution[state] || 0) + 1;
    });

    // Get recent activity (last 10 state changes)
    overview.recentActivity = conversations
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .map(conv => ({
        conversationId: conv.id,
        leadId: conv.leadId,
        currentState: conv.status,
        lastUpdated: conv.updatedAt,
        subject: conv.subject
      }));

    res.json(overview);
  } catch (error) {
    console.error('Failed to get dashboard overview:', error);
    res.status(500).json({ error: 'Failed to get dashboard overview' });
  }
});

/**
 * WebSocket subscription management
 */
router.post('/websocket/subscribe', async (req, res) => {
  try {
    const { userId, subscriptions } = req.body;

    if (!userId || !Array.isArray(subscriptions)) {
      return res.status(400).json({ error: 'userId and subscriptions array are required' });
    }

    // This would typically be handled by the WebSocket connection
    // But we can provide subscription guidance
    res.json({
      message: 'Connect to WebSocket at /ws and send subscribe_state_updates message',
      availableSubscriptions: [
        'conversation_states',
        'lead_journeys', 
        'message_threads',
        'handover_events',
        'email_events',
        'conversation:{conversationId}',
        'lead:{leadId}'
      ],
      example: {
        type: 'subscribe_state_updates',
        subscriptions: subscriptions
      }
    });
  } catch (error) {
    console.error('Failed to handle subscription request:', error);
    res.status(500).json({ error: 'Failed to handle subscription request' });
  }
});

export default router;