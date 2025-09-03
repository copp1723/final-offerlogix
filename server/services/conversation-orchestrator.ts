import { Request, Response, NextFunction } from 'express';
import { conversationIntegrationManager } from './conversation-state/ConversationIntegrationManager';
import { conversationStateManager } from './conversation-state/ConversationStateManager';
import { messageThreadingService } from './conversation-state/MessageThreadingService';
import logger from '../logging/logger';

export interface ConversationRequest extends Request {
  conversationId?: string;
  leadId?: string;
}

/**
 * Conversation Orchestrator - Coordinates conversation lifecycle events
 * This is a thin wrapper that delegates to existing conversation services
 * and manages integration between different conversation touchpoints
 */
export class ConversationOrchestrator {
  
  /**
   * Initialize the orchestrator with existing services
   */
  async initialize(): Promise<void> {
    try {
      // Initialize conversation state integrations
      await conversationIntegrationManager.initializeEmailReliabilityIntegration();
      await conversationIntegrationManager.initializeHandoverIntegration();
      
      logger.info('Conversation orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize conversation orchestrator', { error });
      throw error;
    }
  }

  /**
   * Middleware to orchestrate conversation events from webhooks
   * Extracts conversation context and coordinates with conversation services
   */
  orchestrateConversation = async (
    req: ConversationRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Extract conversation context from webhook event
      const conversationContext = await this.extractConversationContext(req);
      
      if (conversationContext) {
        // Store context in res.locals for downstream services
        res.locals = {
          ...res.locals,
          conversationId: conversationContext.conversationId,
          leadId: conversationContext.leadId,
          campaignId: conversationContext.campaignId
        };

        // Add context to request for convenience
        req.conversationId = conversationContext.conversationId;
        req.leadId = conversationContext.leadId;

        logger.debug('Conversation context extracted', {
          conversationId: conversationContext.conversationId,
          leadId: conversationContext.leadId,
          campaignId: conversationContext.campaignId
        });
      }

      next();
    } catch (error) {
      logger.error('Conversation orchestration failed', { error });
      // Don't block the request - continue processing
      next();
    }
  };

  /**
   * Extract conversation context from webhook request
   * Delegates to existing services to find relevant conversation data
   */
  private async extractConversationContext(req: Request): Promise<{
    conversationId: string;
    leadId: string;
    campaignId?: string;
  } | null> {
    try {
      // Handle different webhook types
      if (req.body['event-data']) {
        // Mailgun event webhook
        return this.extractFromMailgunEvent(req.body);
      } else if (req.body.sender) {
        // Mailgun inbound email webhook
        return this.extractFromInboundEmail(req.body);
      }

      return null;
    } catch (error) {
      logger.error('Failed to extract conversation context', { error });
      return null;
    }
  }

  /**
   * Extract conversation context from Mailgun event webhook
   */
  private async extractFromMailgunEvent(webhookBody: any): Promise<{
    conversationId: string;
    leadId: string;
    campaignId?: string;
  } | null> {
    try {
      const eventData = webhookBody['event-data'];
      const userVariables = eventData['user-variables'] || {};
      
      // Get IDs from user variables
      const leadId = userVariables.leadId;
      const campaignId = userVariables.campaignId;
      
      if (!leadId) {
        return null;
      }

      // Find active conversation for this lead and campaign
      const { storage } = await import('../storage.js');
      const conversations = await storage.getConversationsByLead(leadId);
      const activeConversation = conversations.find(c => 
        c.campaignId === campaignId && c.status !== 'closed'
      );

      if (!activeConversation) {
        return null;
      }

      return {
        conversationId: activeConversation.id,
        leadId,
        campaignId
      };
    } catch (error) {
      logger.error('Failed to extract context from Mailgun event', { error });
      return null;
    }
  }

  /**
   * Extract conversation context from inbound email webhook
   */
  private async extractFromInboundEmail(webhookBody: any): Promise<{
    conversationId: string;
    leadId: string;
    campaignId?: string;
  } | null> {
    try {
      // For inbound emails, we'll extract this info during the inbound processing
      // This method is called before the inbound service processes the email
      // So we return null here and let the inbound service handle context setting
      return null;
    } catch (error) {
      logger.error('Failed to extract context from inbound email', { error });
      return null;
    }
  }

  /**
   * Process post-webhook conversation events
   * Coordinates with conversation services after webhook processing
   */
  async processConversationEvent(
    eventType: string,
    conversationId: string,
    leadId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Create integration event for conversation state management
      const integrationEvent = conversationIntegrationManager.createIntegrationEvent(
        this.mapToIntegrationEventType(eventType),
        conversationId,
        metadata,
        'webhook_orchestrator',
        leadId
      );

      // Process through integration manager
      await conversationIntegrationManager.processIntegrationEvent(integrationEvent);

      logger.info('Conversation event processed through orchestrator', {
        eventType,
        conversationId,
        leadId
      });
    } catch (error) {
      logger.error('Failed to process conversation event', {
        eventType,
        conversationId,
        leadId,
        error
      });
    }
  }

  /**
   * Map webhook event types to integration event types
   */
  private mapToIntegrationEventType(eventType: string): any {
    const mapping: Record<string, any> = {
      'delivered': 'email_delivered',
      'opened': 'email_opened',
      'clicked': 'email_clicked',
      'failed': 'email_bounced',
      'bounced': 'email_bounced',
      'complained': 'email_bounced', // Treat complaints as bounces for conversation state
      'unsubscribed': 'email_bounced'
    };

    return mapping[eventType] || 'email_delivered';
  }

  /**
   * Get conversation status for orchestration
   */
  async getConversationStatus(conversationId: string): Promise<any> {
    try {
      const { storage } = await import('../storage.js');
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return null;
      }

      // Get integration status
      const integrationStatus = await conversationIntegrationManager.getIntegrationStatus(conversationId);

      return {
        ...conversation,
        integrationStatus
      };
    } catch (error) {
      logger.error('Failed to get conversation status', { conversationId, error });
      return null;
    }
  }

  /**
   * Coordinate conversation handover process
   */
  async coordinateHandover(
    conversationId: string,
    leadId: string,
    metadata: Record<string, any>
  ): Promise<boolean> {
    try {
      // Create handover integration event
      const integrationEvent = conversationIntegrationManager.createIntegrationEvent(
        'handover_requested',
        conversationId,
        metadata,
        'conversation_orchestrator',
        leadId
      );

      // Process through integration manager
      const success = await conversationIntegrationManager.processIntegrationEvent(integrationEvent);

      logger.info('Handover coordinated through orchestrator', {
        conversationId,
        leadId,
        success
      });

      return success;
    } catch (error) {
      logger.error('Failed to coordinate handover', { conversationId, leadId, error });
      return false;
    }
  }
}

// Export singleton instance
export const conversationOrchestrator = new ConversationOrchestrator();