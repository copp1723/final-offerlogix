import { enhancedConversationAI, type ConversationContext, type ResponseGenerationOptions, type EnhancedResponse } from './enhanced-conversation-ai';
import { intelligentResponseRouter, type RoutingDecision } from './intelligent-response-router';
import { dynamicResponseIntelligenceService, type ConversationAnalysis } from './dynamic-response-intelligence';
import { leadScoringService } from './lead-scoring';
import { storage } from '../storage';
import type { Conversation, ConversationMessage, Lead } from '@shared/schema';

/**
 * Simplified Conversation Intelligence Hub
 * 
 * Core features only:
 * - Context-aware response generation
 * - Escalation triggers and smart handover
 * - Basic conversation processing
 */

export interface SimpleConversationResult {
  response: {
    content: string;
    confidence: number;
    escalationRecommended: boolean;
  };
  routing: {
    decision: RoutingDecision;
    reasoning: string;
  };
  metadata: {
    processingTime: number;
    servicesUsed: string[];
  };
}

export interface EscalationCandidate {
  conversationId: string;
  leadId: string;
  reason: string;
  priority: 'immediate' | 'urgent' | 'normal';
  lastActivity: Date;
}

export class ConversationIntelligenceHub {
  constructor() {}

  /**
   * Process conversation with context-aware response generation and escalation checking
   */
  async processConversation(
    conversationId: string,
    message: string,
    senderId: string
  ): Promise<SimpleConversationResult> {
    const startTime = Date.now();
    const servicesUsed: string[] = [];

    try {
      // Get conversation context
      const conversation = await storage.getConversation(conversationId);
      if (!conversation || !conversation.leadId) {
        throw new Error('Conversation or lead not found');
      }

      const lead = await storage.getLead(conversation.leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      const conversationHistory = await storage.getConversationMessages(conversationId);

      // Build context for AI response generation
      const context: ConversationContext = {
        leadId: conversation.leadId,
        conversationId,
        leadProfile: lead as any,
        conversationHistory: conversationHistory as any,
        currentAnalysis: {
          conversationId,
          leadId: conversation.leadId,
          mood: 'neutral' as const,
          urgency: 'medium' as const,
          intent: 'research' as const,
          buyingSignals: [],
          nextBestActions: [],
          escalationRecommended: false,
          confidence: 0.8
        },
        leadScore: (lead as any).score || 0,
        priority: 'warm' as const,
        previousResponses: conversationHistory.map(msg => msg.content || '').filter(Boolean)
      };

      // Generate context-aware response
      servicesUsed.push('enhanced-conversation-ai');
      const response = await enhancedConversationAI.generateContextAwareResponse(context, {
        responseType: 'informational',
        urgency: 'medium',
        tone: 'professional',
        personalizationLevel: 'moderate'
      });

      // Check for escalation triggers
      servicesUsed.push('intelligent-response-router');
      const routingResult = await intelligentResponseRouter.routeConversation(
        conversationId,
        message,
        senderId
      );

      return {
        response: {
          content: response.content,
          confidence: response.confidence,
          escalationRecommended: response.escalationRecommended
        },
        routing: {
          decision: routingResult.routingDecision,
          reasoning: routingResult.routingDecision.reasoning
        },
        metadata: {
          processingTime: Date.now() - startTime,
          servicesUsed
        }
      };

    } catch (error) {
      console.error('Conversation processing error:', error);
      throw error;
    }
  }

  /**
   * Get conversations that need escalation
   */
  async getEscalationCandidates(): Promise<EscalationCandidate[]> {
    try {
      return await dynamicResponseIntelligenceService.getEscalationCandidates();
    } catch (error) {
      console.error('Error getting escalation candidates:', error);
      return [];
    }
  }

  /**
   * Basic conversation insights (simplified)
   */
  async getConversationInsights(conversationId: string): Promise<any> {
    try {
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const messages = await storage.getConversationMessages(conversationId);
      
      return {
        conversationId,
        messageCount: messages.length,
        lastActivity: messages[messages.length - 1]?.createdAt || conversation.createdAt,
        status: conversation.status || 'active'
      };
    } catch (error) {
      console.error('Error getting conversation insights:', error);
      throw error;
    }
  }
}

export const conversationIntelligenceHub = new ConversationIntelligenceHub();