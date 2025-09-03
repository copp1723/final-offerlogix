import { storage } from '../../storage';
import { conversationStateManager, ConversationEvent, ConversationState } from './ConversationStateManager';
import { leadJourneyTracker } from './LeadJourneyTracker';
import { messageThreadingService } from './MessageThreadingService';

export interface IntegrationEvent {
  id: string;
  type: 'email_delivered' | 'email_opened' | 'email_clicked' | 'email_bounced' | 'handover_requested' | 'agent_assigned' | 'conversation_completed';
  conversationId: string;
  leadId?: string;
  metadata: Record<string, any>;
  timestamp: Date;
  source: string; // 'email_service', 'handover_service', 'user_action', etc.
}

export interface EmailReliabilityIntegration {
  onEmailDelivered: (event: IntegrationEvent) => Promise<void>;
  onEmailOpened: (event: IntegrationEvent) => Promise<void>;
  onEmailClicked: (event: IntegrationEvent) => Promise<void>;
  onEmailBounced: (event: IntegrationEvent) => Promise<void>;
}

export interface HandoverIntegration {
  onHandoverRequested: (event: IntegrationEvent) => Promise<void>;
  onAgentAssigned: (event: IntegrationEvent) => Promise<void>;
  onHandoverCompleted: (event: IntegrationEvent) => Promise<void>;
}

export interface ConversationMetadata {
  conversationId: string;
  emailDeliveryStatus: 'pending' | 'delivered' | 'failed' | 'bounced';
  emailEngagementScore: number;
  lastEmailSentAt?: Date;
  lastEmailOpenedAt?: Date;
  lastEmailClickedAt?: Date;
  handoverRequestedAt?: Date;
  handoverCompletedAt?: Date;
  assignedAgentId?: string;
  integrationFlags: {
    emailReliabilityEnabled: boolean;
    handoverEnabled: boolean;
    realTimeUpdatesEnabled: boolean;
  };
}

/**
 * Conversation Integration Manager - Handles integration with external services
 */
export class ConversationIntegrationManager {
  private emailReliabilityIntegration: EmailReliabilityIntegration;
  private handoverIntegration: HandoverIntegration;

  constructor() {
    this.emailReliabilityIntegration = {
      onEmailDelivered: this.handleEmailDelivered.bind(this),
      onEmailOpened: this.handleEmailOpened.bind(this),
      onEmailClicked: this.handleEmailClicked.bind(this),
      onEmailBounced: this.handleEmailBounced.bind(this)
    };

    this.handoverIntegration = {
      onHandoverRequested: this.handleHandoverRequested.bind(this),
      onAgentAssigned: this.handleAgentAssigned.bind(this),
      onHandoverCompleted: this.handleHandoverCompleted.bind(this)
    };
  }

  /**
   * Initialize integration with email reliability service
   */
  async initializeEmailReliabilityIntegration(): Promise<void> {
    try {
      console.log('Initializing email reliability integration...');
      
      // Email reliability service integration
      // Note: Service doesn't emit events, integration handled via webhook processing

      console.log('Email reliability integration initialized');
    } catch (error) {
      console.error('Failed to initialize email reliability integration:', error);
    }
  }

  /**
   * Initialize integration with handover service
   */
  async initializeHandoverIntegration(): Promise<void> {
    try {
      console.log('Initializing handover service integration...');
      
      // Handover service integration
      // Note: Service doesn't emit events, integration handled via direct service calls

      console.log('Handover service integration initialized');
    } catch (error) {
      console.error('Failed to initialize handover service integration:', error);
    }
  }

  /**
   * Process integration event and update conversation state
   */
  async processIntegrationEvent(event: IntegrationEvent): Promise<boolean> {
    try {
      console.log(`Processing integration event: ${event.type} for conversation ${event.conversationId}`);

      // Update conversation metadata
      await this.updateConversationMetadata(event);

      // Determine conversation event from integration event
      const conversationEvent = this.mapIntegrationEventToConversationEvent(event);
      
      if (conversationEvent) {
        // Trigger state transition
        const success = await conversationStateManager.transitionState(
          event.conversationId,
          conversationEvent,
          'integration_system',
          {
            integrationEvent: event,
            source: event.source,
            originalMetadata: event.metadata
          }
        );

        if (success) {
          console.log(`State transition triggered by ${event.type} event`);
        }

        return success;
      }

      return true;
    } catch (error) {
      console.error('Failed to process integration event:', error);
      return false;
    }
  }

  /**
   * Map integration events to conversation events
   */
  private mapIntegrationEventToConversationEvent(event: IntegrationEvent): ConversationEvent | null {
    const mapping = {
      'email_delivered': ConversationEvent.FIRST_EMAIL_SENT,
      'email_opened': ConversationEvent.ENGAGEMENT_INCREASED,
      'email_clicked': ConversationEvent.ENGAGEMENT_INCREASED,
      'email_bounced': null, // Handled separately, might trigger abandonment
      'handover_requested': ConversationEvent.HANDOVER_REQUESTED,
      'agent_assigned': ConversationEvent.HUMAN_AGENT_ASSIGNED,
      'conversation_completed': ConversationEvent.CONVERSATION_COMPLETED
    };

    return mapping[event.type as keyof typeof mapping] || null;
  }

  /**
   * Update conversation metadata with integration data
   */
  private async updateConversationMetadata(event: IntegrationEvent): Promise<void> {
    try {
      // Get existing metadata
      const metadata = await this.getConversationMetadata(event.conversationId);
      
      // Update based on event type
      switch (event.type) {
        case 'email_delivered':
          metadata.emailDeliveryStatus = 'delivered';
          metadata.lastEmailSentAt = event.timestamp;
          break;
          
        case 'email_opened':
          metadata.lastEmailOpenedAt = event.timestamp;
          metadata.emailEngagementScore += 10;
          break;
          
        case 'email_clicked':
          metadata.lastEmailClickedAt = event.timestamp;
          metadata.emailEngagementScore += 20;
          break;
          
        case 'email_bounced':
          metadata.emailDeliveryStatus = 'bounced';
          break;
          
        case 'handover_requested':
          metadata.handoverRequestedAt = event.timestamp;
          break;
          
        case 'agent_assigned':
          metadata.assignedAgentId = event.metadata.agentId;
          break;
          
        case 'conversation_completed':
          metadata.handoverCompletedAt = event.timestamp;
          break;
      }

      // Store updated metadata
      await this.storeConversationMetadata(metadata);
    } catch (error) {
      console.error('Failed to update conversation metadata:', error);
    }
  }

  /**
   * Get conversation metadata
   */
  async getConversationMetadata(conversationId: string): Promise<ConversationMetadata> {
    try {
      // In production, this would be stored in a metadata table
      // For now, create default metadata
      return {
        conversationId,
        emailDeliveryStatus: 'pending',
        emailEngagementScore: 0,
        integrationFlags: {
          emailReliabilityEnabled: true,
          handoverEnabled: true,
          realTimeUpdatesEnabled: true
        }
      };
    } catch (error) {
      console.error('Failed to get conversation metadata:', error);
      throw error;
    }
  }

  /**
   * Store conversation metadata
   */
  private async storeConversationMetadata(metadata: ConversationMetadata): Promise<void> {
    try {
      // In production, this would be stored in a metadata table
      console.log('Storing conversation metadata:', metadata);
    } catch (error) {
      console.error('Failed to store conversation metadata:', error);
    }
  }

  // Email Reliability Integration Handlers

  /**
   * Handle email delivered event
   */
  private async handleEmailDelivered(event: IntegrationEvent): Promise<void> {
    console.log(`Email delivered for conversation ${event.conversationId}`);
    
    // Update email delivery status
    await this.processIntegrationEvent({
      ...event,
      type: 'email_delivered'
    });

    // If this is the first email, transition to active state
    const conversation = await storage.getConversation(event.conversationId);
    if (conversation?.status === ConversationState.NEW) {
      await conversationStateManager.transitionState(
        event.conversationId,
        ConversationEvent.FIRST_EMAIL_SENT,
        'email_service',
        { emailDelivered: true, messageId: event.metadata.messageId }
      );
    }
  }

  /**
   * Handle email opened event
   */
  private async handleEmailOpened(event: IntegrationEvent): Promise<void> {
    console.log(`Email opened for conversation ${event.conversationId}`);
    
    await this.processIntegrationEvent({
      ...event,
      type: 'email_opened'
    });

    // Track engagement increase
    await conversationStateManager.transitionState(
      event.conversationId,
      ConversationEvent.ENGAGEMENT_INCREASED,
      'email_service',
      { 
        emailOpened: true, 
        openedAt: event.timestamp,
        userAgent: event.metadata.userAgent 
      }
    );
  }

  /**
   * Handle email clicked event
   */
  private async handleEmailClicked(event: IntegrationEvent): Promise<void> {
    console.log(`Email clicked for conversation ${event.conversationId}`);
    
    await this.processIntegrationEvent({
      ...event,
      type: 'email_clicked'
    });

    // High engagement signal - track as increased engagement
    await conversationStateManager.transitionState(
      event.conversationId,
      ConversationEvent.ENGAGEMENT_INCREASED,
      'email_service',
      { 
        emailClicked: true, 
        clickedUrl: event.metadata.url,
        clickedAt: event.timestamp 
      }
    );
  }

  /**
   * Handle email bounced event
   */
  private async handleEmailBounced(event: IntegrationEvent): Promise<void> {
    console.log(`Email bounced for conversation ${event.conversationId}`);
    
    await this.processIntegrationEvent({
      ...event,
      type: 'email_bounced'
    });

    // If hard bounce, consider abandoning conversation
    if (event.metadata.bounceType === 'hard') {
      await conversationStateManager.transitionState(
        event.conversationId,
        ConversationEvent.CONVERSATION_ABANDONED,
        'email_service',
        { 
          bounceType: 'hard',
          bounceReason: event.metadata.reason 
        }
      );
    }
  }

  // Handover Integration Handlers

  /**
   * Handle handover requested event
   */
  private async handleHandoverRequested(event: IntegrationEvent): Promise<void> {
    console.log(`Handover requested for conversation ${event.conversationId}`);
    
    await this.processIntegrationEvent({
      ...event,
      type: 'handover_requested'
    });

    // Generate handover summary for human agent
    await this.generateHandoverSummary(event.conversationId);
  }

  /**
   * Handle agent assigned event
   */
  private async handleAgentAssigned(event: IntegrationEvent): Promise<void> {
    console.log(`Agent assigned to conversation ${event.conversationId}`);
    
    // Update conversation with assigned agent
    await storage.updateConversation(event.conversationId, {
      userId: event.metadata.agentId
    });

    await this.processIntegrationEvent({
      ...event,
      type: 'agent_assigned'
    });
  }

  /**
   * Handle handover completed event
   */
  private async handleHandoverCompleted(event: IntegrationEvent): Promise<void> {
    console.log(`Handover completed for conversation ${event.conversationId}`);
    
    await this.processIntegrationEvent({
      ...event,
      type: 'conversation_completed'
    });

    // Generate conversation analytics
    await this.generateConversationAnalytics(event.conversationId);
  }

  /**
   * Generate handover summary for human agent
   */
  private async generateHandoverSummary(conversationId: string): Promise<void> {
    try {
      const context = await messageThreadingService.getConversationContext(conversationId);
      const analytics = await conversationStateManager.getConversationAnalytics(conversationId);
      const progress = await leadJourneyTracker.getLeadProgress(context.leadId);

      const handoverSummary = {
        conversationId,
        leadInfo: {
          id: context.leadId,
          currentStage: progress.currentStage.name,
          qualificationScore: progress.qualificationScore,
          engagementScore: analytics?.metrics?.engagementScore || 0
        },
        conversationSummary: {
          messageCount: context.messageHistory.length,
          lastActivity: context.lastEngagementAt,
          keyTopics: context.keyTopics,
          currentIntent: context.currentIntent
        },
        recommendations: [
          'Lead shows high engagement and purchase intent',
          'Ready for detailed product discussion',
          'Consider scheduling in-person appointment'
        ]
      };

      // Store handover summary for agent reference
      console.log('Handover summary generated:', handoverSummary);
      
      // In production, this would be stored and made available to agents
    } catch (error) {
      console.error('Failed to generate handover summary:', error);
    }
  }

  /**
   * Generate conversation analytics
   */
  private async generateConversationAnalytics(conversationId: string): Promise<void> {
    try {
      const analytics = await conversationStateManager.getConversationAnalytics(conversationId);
      const metadata = await this.getConversationMetadata(conversationId);
      
      const finalAnalytics = {
        ...analytics,
        emailMetrics: {
          deliveryStatus: metadata.emailDeliveryStatus,
          engagementScore: metadata.emailEngagementScore,
          lastOpened: metadata.lastEmailOpenedAt,
          lastClicked: metadata.lastEmailClickedAt
        },
        handoverMetrics: {
          requestedAt: metadata.handoverRequestedAt,
          completedAt: metadata.handoverCompletedAt,
          assignedAgent: metadata.assignedAgentId
        },
        outcome: 'handed_over' // or 'converted', 'abandoned', etc.
      };

      console.log('Final conversation analytics:', finalAnalytics);
      
      // Store for reporting and insights
    } catch (error) {
      console.error('Failed to generate conversation analytics:', error);
    }
  }

  /**
   * Create integration event
   */
  createIntegrationEvent(
    type: IntegrationEvent['type'],
    conversationId: string,
    metadata: Record<string, any>,
    source: string,
    leadId?: string
  ): IntegrationEvent {
    return {
      id: `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      conversationId,
      leadId,
      metadata,
      timestamp: new Date(),
      source
    };
  }

  /**
   * Get integration status for conversation
   */
  async getIntegrationStatus(conversationId: string): Promise<any> {
    try {
      const metadata = await this.getConversationMetadata(conversationId);
      const conversation = await storage.getConversation(conversationId);
      
      return {
        conversationId,
        currentState: conversation?.status,
        emailIntegration: {
          enabled: metadata.integrationFlags.emailReliabilityEnabled,
          deliveryStatus: metadata.emailDeliveryStatus,
          engagementScore: metadata.emailEngagementScore,
          lastActivity: metadata.lastEmailOpenedAt || metadata.lastEmailClickedAt
        },
        handoverIntegration: {
          enabled: metadata.integrationFlags.handoverEnabled,
          status: metadata.handoverRequestedAt ? 'requested' : 'available',
          assignedAgent: metadata.assignedAgentId,
          completedAt: metadata.handoverCompletedAt
        },
        realTimeUpdates: {
          enabled: metadata.integrationFlags.realTimeUpdatesEnabled
        }
      };
    } catch (error) {
      console.error('Failed to get integration status:', error);
      return null;
    }
  }

  /**
   * Enable/disable integrations for conversation
   */
  async updateIntegrationFlags(
    conversationId: string, 
    flags: Partial<ConversationMetadata['integrationFlags']>
  ): Promise<boolean> {
    try {
      const metadata = await this.getConversationMetadata(conversationId);
      metadata.integrationFlags = { ...metadata.integrationFlags, ...flags };
      await this.storeConversationMetadata(metadata);
      return true;
    } catch (error) {
      console.error('Failed to update integration flags:', error);
      return false;
    }
  }
}

export const conversationIntegrationManager = new ConversationIntegrationManager();