import Redis from 'ioredis';
import { storage } from '../../storage';
import { webSocketService } from '../websocket';
import type { ConversationMessage } from '@shared/schema';
import logger from '../../logging/logger';
import { toError } from '../../utils/error-utils';

// Conversation state machine states
export enum ConversationState {
  NEW = 'new',
  ACTIVE = 'active',
  ENGAGED = 'engaged',
  QUALIFIED = 'qualified',
  READY_FOR_HANDOVER = 'ready_for_handover',
  HANDED_OVER = 'handed_over',
  CLOSED = 'closed',
  ARCHIVED = 'archived'
}

// Conversation events that trigger state transitions
export enum ConversationEvent {
  FIRST_EMAIL_SENT = 'first_email_sent',
  LEAD_REPLIED = 'lead_replied',
  ENGAGEMENT_INCREASED = 'engagement_increased',
  QUALIFICATION_CRITERIA_MET = 'qualification_criteria_met',
  HANDOVER_REQUESTED = 'handover_requested',
  HUMAN_AGENT_ASSIGNED = 'human_agent_assigned',
  CONVERSATION_COMPLETED = 'conversation_completed',
  CONVERSATION_ABANDONED = 'conversation_abandoned',
  MANUAL_ARCHIVE = 'manual_archive'
}

// Lead journey milestones
export enum LeadMilestone {
  FIRST_CONTACT = 'first_contact',
  FIRST_RESPONSE = 'first_response',
  MULTIPLE_EXCHANGES = 'multiple_exchanges',
  INTENT_SIGNAL = 'intent_signal',
  QUALIFICATION_COMPLETE = 'qualification_complete',
  HANDOVER_READY = 'handover_ready',
  CONVERTED = 'converted'
}

export interface ConversationStateTransition {
  id: string;
  conversationId: string;
  fromState: ConversationState;
  toState: ConversationState;
  event: ConversationEvent;
  triggeredBy: string; // user ID or 'system'
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface LeadJourneyEvent {
  id: string;
  leadId: string;
  conversationId: string;
  milestone: LeadMilestone;
  event: ConversationEvent;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ConversationMetrics {
  conversationId: string;
  messageCount: number;
  aiMessageCount: number;
  humanMessageCount: number;
  lastActivityAt: Date;
  engagementScore: number;
  responseTime: number; // average response time in minutes
  qualificationScore: number;
}

/**
 * Conversation State Manager - Handles conversation lifecycle and state transitions
 */
export class ConversationStateManager {
  private stateTransitions: Map<ConversationState, ConversationState[]> = new Map();
  private redis: Redis;

  constructor() {
    this.initializeStateMachine();
    const redisConfig = {
      host: process.env.REDIS_HOST || process.env.REDIS_URL?.split('://')[1]?.split(':')[0] || 'localhost',
      port: parseInt(process.env.REDIS_PORT || process.env.REDIS_URL?.split(':')[2] || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      commandTimeout: 5000,
    };

    this.redis = new Redis(redisConfig);
    this.redis.on('error', (err) => {
      logger.error('Redis connection error in ConversationStateManager', { error: toError(err) });
    });
  }

  private historyKey(conversationId: string): string {
    return `conversation:${conversationId}:history`;
  }

  async getRecentMessages(conversationId: string, limit = 5): Promise<ConversationMessage[]> {
    const key = this.historyKey(conversationId);
    try {
      const entries = await this.redis.lrange(key, -limit, -1);
      if (entries.length) {
        return entries.map((e) => JSON.parse(e) as ConversationMessage);
      }
    } catch (err) {
      logger.warn('Failed to fetch conversation history from Redis, falling back to storage', { 
        conversationId, 
        error: toError(err) 
      });
    }
    return await storage.getConversationMessages(conversationId, limit);
  }

  async addMessageToHistory(message: ConversationMessage, limit = 5): Promise<void> {
    if (!message.conversationId) return;
    const key = this.historyKey(message.conversationId);
    try {
      await this.redis.rpush(key, JSON.stringify(message));
      await this.redis.ltrim(key, -limit, -1);
      await this.redis.expire(key, 86400); // Expire after 24 hours
    } catch (err) {
      logger.warn('Failed to store conversation history in Redis', { 
        conversationId: message.conversationId, 
        error: toError(err) 
      });
    }
  }

  /**
   * Initialize valid state transitions
   */
  private initializeStateMachine(): void {
    this.stateTransitions.set(ConversationState.NEW, [
      ConversationState.ACTIVE,
      ConversationState.CLOSED
    ]);

    this.stateTransitions.set(ConversationState.ACTIVE, [
      ConversationState.ENGAGED,
      ConversationState.CLOSED,
      ConversationState.ARCHIVED
    ]);

    this.stateTransitions.set(ConversationState.ENGAGED, [
      ConversationState.QUALIFIED,
      ConversationState.ACTIVE,
      ConversationState.CLOSED
    ]);

    this.stateTransitions.set(ConversationState.QUALIFIED, [
      ConversationState.READY_FOR_HANDOVER,
      ConversationState.ENGAGED,
      ConversationState.CLOSED
    ]);

    this.stateTransitions.set(ConversationState.READY_FOR_HANDOVER, [
      ConversationState.HANDED_OVER,
      ConversationState.QUALIFIED,
      ConversationState.CLOSED
    ]);

    this.stateTransitions.set(ConversationState.HANDED_OVER, [
      ConversationState.CLOSED
    ]);

    this.stateTransitions.set(ConversationState.CLOSED, [
      ConversationState.ARCHIVED,
      ConversationState.ACTIVE // Reopen if needed
    ]);

    this.stateTransitions.set(ConversationState.ARCHIVED, []);
  }

  /**
   * Check if a state transition is valid
   */
  isValidTransition(fromState: ConversationState, toState: ConversationState): boolean {
    const validTransitions = this.stateTransitions.get(fromState);
    return validTransitions ? validTransitions.includes(toState) : false;
  }

  /**
   * Transition conversation to new state
   */
  async transitionState(
    conversationId: string,
    event: ConversationEvent,
    triggeredBy: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      logger.info('Conversation state transition requested', {
        conversationId,
        event,
        triggeredBy,
        metadata,
      });
      
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const currentState = conversation.status as ConversationState;
      const newState = this.getNextState(currentState, event);

      if (!newState) {
        logger.warn('No state transition defined for event from state', {
          conversationId,
          event,
          currentState,
        });
        return false;
      }

      if (!this.isValidTransition(currentState, newState)) {
        logger.warn('Invalid conversation state transition', {
          conversationId,
          fromState: currentState,
          attemptedState: newState,
          event,
        });
        return false;
      }

      // Validate business logic for this transition
      const { conversationValidator } = await import('./ConversationValidator.js');
      const validationResult = await conversationValidator.validateTransition({
        conversationId,
        leadId: conversation.leadId || undefined,
        fromState: currentState,
        toState: newState,
        event,
        metadata,
        triggeredBy
      });

      if (!validationResult.canProceed) {
        logger.warn('State transition validation failed', {
          conversationId,
          reason: validationResult.reason,
          requirements: validationResult.requirements,
        });
        return false;
      }

      // Log validation warnings if any
      if (validationResult.warnings) {
        logger.warn('State transition warnings', {
          conversationId,
          warnings: validationResult.warnings,
        });
      }

      // Update conversation status
      await storage.updateConversation(conversationId, {
        status: newState,
      });

      // Record state transition
      await this.recordStateTransition({
        id: this.generateId(),
        conversationId,
        fromState: currentState,
        toState: newState,
        event,
        triggeredBy,
        metadata,
        timestamp: new Date()
      });

      // Update lead journey if applicable
      if (conversation.leadId) {
        await this.updateLeadJourney(conversation.leadId, conversationId, event, metadata);
      }

      // Broadcast state change via WebSocket
      this.broadcastStateChange(conversationId, currentState, newState, event);

      // Trigger side effects based on new state
      await this.handleStateTransitionSideEffects(
        conversationId,
        newState,
        event,
        metadata,
      );

      logger.info('Conversation state transitioned', {
        conversationId,
        fromState: currentState,
        toState: newState,
        event,
        triggeredBy,
      });

      return true;
    } catch (error) {
      logger.error('State transition failed', { conversationId, error: toError(error) });
      return false;
    }
  }

  /**
   * Get next state based on current state and event
   */
  private getNextState(currentState: ConversationState, event: ConversationEvent): ConversationState | null {
    const transitions = {
      [ConversationState.NEW]: {
        [ConversationEvent.FIRST_EMAIL_SENT]: ConversationState.ACTIVE
      },
      [ConversationState.ACTIVE]: {
        [ConversationEvent.LEAD_REPLIED]: ConversationState.ENGAGED,
        [ConversationEvent.CONVERSATION_ABANDONED]: ConversationState.CLOSED
      },
      [ConversationState.ENGAGED]: {
        [ConversationEvent.ENGAGEMENT_INCREASED]: ConversationState.ENGAGED,
        [ConversationEvent.QUALIFICATION_CRITERIA_MET]: ConversationState.QUALIFIED,
        [ConversationEvent.CONVERSATION_ABANDONED]: ConversationState.CLOSED
      },
      [ConversationState.QUALIFIED]: {
        [ConversationEvent.HANDOVER_REQUESTED]: ConversationState.READY_FOR_HANDOVER,
        [ConversationEvent.ENGAGEMENT_INCREASED]: ConversationState.QUALIFIED
      },
      [ConversationState.READY_FOR_HANDOVER]: {
        [ConversationEvent.HUMAN_AGENT_ASSIGNED]: ConversationState.HANDED_OVER
      },
      [ConversationState.HANDED_OVER]: {
        [ConversationEvent.CONVERSATION_COMPLETED]: ConversationState.CLOSED
      },
      [ConversationState.CLOSED]: {
        [ConversationEvent.MANUAL_ARCHIVE]: ConversationState.ARCHIVED
      }
    };

    return (transitions as any)[currentState]?.[event] || null;
  }

  /**
   * Update lead journey milestones
   */
  private async updateLeadJourney(
    leadId: string,
    conversationId: string,
    event: ConversationEvent,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Update journey tracker
      const { leadJourneyTracker } = await import('./LeadJourneyTracker.js');
      await leadJourneyTracker.updateLeadProgress(leadId, conversationId, event, metadata);

      // Record milestone event
      const milestone = this.mapEventToMilestone(event);
      if (milestone) {
        const journeyEvent: LeadJourneyEvent = {
          id: this.generateId(),
          leadId,
          conversationId,
          milestone,
          event,
          metadata,
          timestamp: new Date()
        };

        await this.recordLeadJourneyEvent(journeyEvent);
      }
    } catch (error) {
      logger.error('Failed to update lead journey', { leadId, conversationId, error: toError(error) });
    }
  }

  /**
   * Map conversation events to lead milestones
   */
  private mapEventToMilestone(event: ConversationEvent): LeadMilestone | null {
    const mapping = {
      [ConversationEvent.FIRST_EMAIL_SENT]: LeadMilestone.FIRST_CONTACT,
      [ConversationEvent.LEAD_REPLIED]: LeadMilestone.FIRST_RESPONSE,
      [ConversationEvent.ENGAGEMENT_INCREASED]: LeadMilestone.MULTIPLE_EXCHANGES,
      [ConversationEvent.QUALIFICATION_CRITERIA_MET]: LeadMilestone.QUALIFICATION_COMPLETE,
      [ConversationEvent.HANDOVER_REQUESTED]: LeadMilestone.HANDOVER_READY,
      [ConversationEvent.CONVERSATION_COMPLETED]: LeadMilestone.CONVERTED
    };

    return (mapping as any)[event] || null;
  }

  /**
   * Handle side effects of state transitions
   */
  private async handleStateTransitionSideEffects(
    conversationId: string,
    newState: ConversationState,
    event: ConversationEvent,
    metadata?: Record<string, any>
  ): Promise<void> {
    switch (newState) {
      case ConversationState.READY_FOR_HANDOVER:
        await this.triggerHandoverProcess(conversationId, metadata);
        break;
      case ConversationState.HANDED_OVER:
        await this.notifyHumanAgent(conversationId, metadata);
        break;
      case ConversationState.CLOSED:
        await this.finalizeConversation(conversationId, metadata);
        break;
    }
  }

  /**
   * Trigger handover process
   */
  private async triggerHandoverProcess(conversationId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const { maybeTriggerIntentHandover } = await import('../handover/handover-service.js');
      await maybeTriggerIntentHandover({ leadId: conversationId, campaignId: '' });
    } catch (error) {
      logger.error('Failed to trigger handover process', { conversationId, error: toError(error) });
    }
  }

  /**
   * Notify human agent of handover
   */
  private async notifyHumanAgent(conversationId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const conversation = await storage.getConversation(conversationId);
      if (conversation?.userId) {
        // TODO: Send notification to assigned agent
        logger.info('Handover assigned for conversation', { conversationId });
      }
    } catch (error) {
      logger.error('Failed to notify human agent', { conversationId, error: toError(error) });
    }
  }

  /**
   * Finalize conversation
   */
  private async finalizeConversation(conversationId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      // Update conversation metrics
      await this.updateConversationMetrics(conversationId);
      
      // Archive old messages if needed
      const conversation = await storage.getConversation(conversationId);
      if (conversation) {
        logger.info('Conversation finalized', { conversationId });
      }
    } catch (error) {
      logger.error('Failed to finalize conversation', { conversationId, error: toError(error) });
    }
  }

  /**
   * Calculate and update conversation metrics
   */
  async updateConversationMetrics(conversationId: string): Promise<ConversationMetrics | null> {
    try {
      const messages = await storage.getConversationMessages(conversationId);
      if (messages.length === 0) return null;

      const aiMessages = messages.filter(m => m.isFromAI === 1);
      const humanMessages = messages.filter(m => m.isFromAI === 0);
      
      const lastActivity = messages[messages.length - 1]?.createdAt || new Date();
      
      // Calculate engagement score based on response count and timing
      const engagementScore = this.calculateEngagementScore(messages);
      
      // Calculate average response time
      const responseTime = this.calculateAverageResponseTime(messages);
      
      // Calculate qualification score
      const qualificationScore = this.calculateQualificationScore(messages);

      const metrics: ConversationMetrics = {
        conversationId,
        messageCount: messages.length,
        aiMessageCount: aiMessages.length,
        humanMessageCount: humanMessages.length,
        lastActivityAt: lastActivity,
        engagementScore,
        responseTime,
        qualificationScore
      };

      // Store metrics (would need a metrics table in production)
      logger.info('Conversation metrics calculated', { conversationId, metrics });

      return metrics;
    } catch (error) {
      logger.error('Failed to update conversation metrics', { conversationId, error: toError(error) });
      return null;
    }
  }

  /**
   * Calculate engagement score based on message patterns
   */
  private calculateEngagementScore(messages: any[]): number {
    if (messages.length === 0) return 0;
    
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const responseRate = humanMessages.length / Math.max(1, messages.length);
    
    // Quick responses get higher scores
    let timeScore = 0;
    for (let i = 1; i < messages.length; i++) {
      const timeDiff = new Date(messages[i].createdAt).getTime() - new Date(messages[i-1].createdAt).getTime();
      const hours = timeDiff / (1000 * 60 * 60);
      
      if (hours < 1) timeScore += 10;
      else if (hours < 4) timeScore += 5;
      else if (hours < 24) timeScore += 2;
    }
    
    return Math.min(100, Math.round((responseRate * 50) + (timeScore / messages.length * 50)));
  }

  /**
   * Calculate average response time in minutes
   */
  private calculateAverageResponseTime(messages: any[]): number {
    if (messages.length < 2) return 0;
    
    const responseTimes: number[] = [];
    
    for (let i = 1; i < messages.length; i++) {
      const timeDiff = new Date(messages[i].createdAt).getTime() - new Date(messages[i-1].createdAt).getTime();
      responseTimes.push(timeDiff / (1000 * 60)); // Convert to minutes
    }
    
    return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }

  /**
   * Calculate qualification score based on message content
   */
  private calculateQualificationScore(messages: any[]): number {
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    if (humanMessages.length === 0) return 0;
    
    let score = 0;
    const qualificationKeywords = [
      'interested', 'when', 'price', 'cost', 'buy', 'purchase', 'financing',
      'test drive', 'schedule', 'appointment', 'visit', 'dealership'
    ];
    
    humanMessages.forEach(message => {
      const content = message.content.toLowerCase();
      qualificationKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          score += 10;
        }
      });
    });
    
    return Math.min(100, score);
  }

  /**
   * Broadcast state change via WebSocket
   */
  private broadcastStateChange(
    conversationId: string,
    fromState: ConversationState,
    toState: ConversationState,
    event: ConversationEvent
  ): void {
    if (webSocketService.broadcastConversationStateChange) {
      webSocketService.broadcastConversationStateChange(conversationId, {
        fromState,
        toState,
        event,
        stateTransition: {
          valid: true,
          timestamp: new Date()
        }
      });
    }
  }

  /**
   * Record state transition in audit log
   */
  private async recordStateTransition(transition: ConversationStateTransition): Promise<void> {
    try {
      // In production, this would be stored in a state_transitions table
      logger.info('State transition recorded', transition);
    } catch (error) {
      logger.error('Failed to record state transition', { transition, error: toError(error) });
    }
  }

  /**
   * Record lead journey event
   */
  private async recordLeadJourneyEvent(journeyEvent: LeadJourneyEvent): Promise<void> {
    try {
      // In production, this would be stored in a lead_journey_events table
      logger.info('Lead journey event recorded', journeyEvent);
    } catch (error) {
      logger.error('Failed to record lead journey event', { journeyEvent, error: toError(error) });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(conversationId: string): Promise<any> {
    try {
      const conversation = await storage.getConversation(conversationId);
      const messages = await storage.getConversationMessages(conversationId);
      const metrics = await this.updateConversationMetrics(conversationId);
      
      return {
        conversation,
        messages,
        metrics,
        currentState: conversation?.status,
        messageCount: messages.length,
        lastActivity: messages[messages.length - 1]?.createdAt
      };
    } catch (error) {
      logger.error('Failed to get conversation analytics', { conversationId, error: toError(error) });
      return null;
    }
  }

  /**
   * Get lead journey summary
   */
  async getLeadJourney(leadId: string): Promise<any> {
    try {
      const conversations = await storage.getConversationsByLead(leadId);
      const lead = await storage.getLead(leadId);
      
      const journey = {
        lead,
        conversations: conversations.map(conv => ({
          ...conv,
          messageCount: 0 // Would be populated from actual message counts
        })),
        milestones: [], // Would be populated from journey events table
        overallScore: this.calculateLeadScore(conversations)
      };
      
      return journey;
    } catch (error) {
      logger.error('Failed to get lead journey', { leadId, error: toError(error) });
      return null;
    }
  }

  /**
   * Calculate overall lead score
   */
  private calculateLeadScore(conversations: any[]): number {
    if (conversations.length === 0) return 0;
    
    let score = 0;
    conversations.forEach(conv => {
      switch (conv.status) {
        case ConversationState.ENGAGED:
          score += 20;
          break;
        case ConversationState.QUALIFIED:
          score += 40;
          break;
        case ConversationState.READY_FOR_HANDOVER:
          score += 60;
          break;
        case ConversationState.HANDED_OVER:
          score += 80;
          break;
        case ConversationState.CLOSED:
          score += 100;
          break;
      }
    });
    
    return Math.min(100, score / conversations.length);
  }

  /**
   * Cleanup conversations with no activity beyond the cutoff
   */
  async cleanupAbandonedConversations(thresholdHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
    try {
      const cleaned = await storage.cleanupAbandonedConversations(cutoff);
      if (cleaned > 0) {
        logger.info('Cleaned up abandoned conversations', { count: cleaned });
      }
      return cleaned;
    } catch (error) {
      logger.error('Failed to cleanup abandoned conversations', { error: toError(error) });
      return 0;
    }
  }
}

export const conversationStateManager = new ConversationStateManager();