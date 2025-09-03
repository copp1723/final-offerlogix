import { storage } from '../../storage';
import { detectIntentFromConversation } from '../intent-detector';
import logger from '../../logging/logger';
import { calculateLeadScore, DEFAULT_SCORE_THRESHOLDS, type LeadScoreWeights } from '../lead-score';

interface HandoverParams {
  leadId: string;
  campaignId: string;
}

export interface ConversationAnalysis {
  intent: string;
  confidence: number;
  keyEntities: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  readyForHandover: boolean;
  qualificationScore: number;
  intentScore: number;
  urgencyLevel: 'high' | 'medium' | 'low';
  detectedIntents: string[];
  automotiveContext?: {
    vehicleType?: string;
    priceRange?: string;
    timeframe?: string;
  };
}

interface HandoverCriteria {
  intents: string[];
  threshold?: number; // minimum occurrences before handover
  scoreThresholds?: { immediate: number; scheduled: number };
  weights?: Partial<LeadScoreWeights>;
}

/**
 * Intent-based handover service
 * Evaluates lead messages against campaign criteria and triggers handover when conditions are met
 */
export class IntentHandoverService {
  /**
   * Evaluates if a handover should be triggered based on lead's recent messages
   * This is designed to be called non-blocking from email processing
   */
  static async maybeTriggerIntentHandover(params: HandoverParams): Promise<void> {
    try {
      const { leadId, campaignId } = params;
      
      // Get campaign handover configuration
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign?.handoverCriteria) {
        logger.debug('No handover criteria configured', { campaignId });
        return;
      }

      const criteria = this.parseHandoverCriteria(campaign.handoverCriteria);
      if (!criteria) {
        logger.warn('Invalid handover criteria format', { campaignId, criteria: campaign.handoverCriteria });
        return;
      }

      // Get lead's recent conversation messages
      const conversations = await storage.getConversationsByLead(leadId);
      if (!conversations.length) {
        logger.debug('No conversations found for lead', { leadId });
        return;
      }

      const recentMessages = await storage.getConversationMessages(conversations[0].id, 5);
      const leadMessages = recentMessages
        .filter(m => m.messageType === 'lead_msg')
        .map(m => m.content)
        .slice(0, 3); // Last 3 lead messages

      if (!leadMessages.length) {
        logger.debug('No lead messages found for intent evaluation', { leadId });
        return;
      }

      // Calculate lead score using campaign weights
      const campaignWeights = (campaign as any)?.leadScoreWeights || {};
      const score = calculateLeadScore(leadMessages, campaignWeights);
      await storage.insertLeadScore({ leadId, campaignId, score });

      // Get score thresholds from campaign or use defaults
      const thresholds = (campaign as any)?.handoverScoreThresholds || DEFAULT_SCORE_THRESHOLDS;

      if (score < thresholds.scheduled) {
        logger.debug('Lead score below handover threshold', { leadId, score, threshold: thresholds.scheduled });
        return;
      }

      // Detect intent from conversation
      const detectedIntent = await detectIntentFromConversation(leadMessages);
      logger.debug('Intent detected', { leadId, campaignId, intent: detectedIntent });

      // Check if detected intent matches handover criteria
      if (!criteria.intents.includes(detectedIntent)) {
        logger.debug('Intent does not match handover criteria', { 
          leadId, 
          detectedIntent, 
          criteriaIntents: criteria.intents,
          score 
        });
        return;
      }

      // Check if we've already triggered handover for this intent
      const existingHandover = await storage.getHandoverEvents(leadId, campaignId, detectedIntent);
      if (existingHandover.length > 0) {
        logger.debug('Handover already triggered for this intent', { leadId, intent: detectedIntent });
        return;
      }

      // Check threshold if specified
      if (criteria.threshold && criteria.threshold > 1) {
        const intentCount = await this.countRecentIntentOccurrences(leadId, detectedIntent);
        if (intentCount < criteria.threshold) {
          logger.debug('Intent threshold not met', { 
            leadId, 
            intent: detectedIntent, 
            count: intentCount, 
            threshold: criteria.threshold,
            score 
          });
          return;
        }
      }

      // Determine action based on score
      if (score >= thresholds.immediate) {
        // Trigger immediate handover
        await this.triggerHandover(leadId, campaignId, detectedIntent, campaign.handoverRecipient);
        
        logger.info('Intent handover triggered immediately', { 
          leadId, 
          campaignId, 
          intent: detectedIntent,
          recipient: campaign.handoverRecipient,
          score 
        });
      } else {
        // Schedule handover for later review
        logger.info('Lead scheduled for handover review', { 
          leadId, 
          campaignId, 
          intent: detectedIntent,
          score,
          threshold: thresholds.immediate
        });
      }

    } catch (error) {
      logger.error('Intent handover evaluation failed', {
        ...params,
        error: error instanceof Error ? error : new Error(String(error))
      });
      // Don't throw - this should not block email processing
    }
  }

  /**
   * Parse handover criteria from campaign configuration
   */
  private static parseHandoverCriteria(criteria: any): HandoverCriteria | null {
    try {
      if (typeof criteria === 'string') {
        criteria = JSON.parse(criteria);
      }

      if (!criteria || typeof criteria !== 'object') {
        return null;
      }

      const { intents, threshold } = criteria;
      
      if (!Array.isArray(intents) || intents.length === 0) {
        return null;
      }

      return {
        intents: intents.filter(i => typeof i === 'string'),
        threshold: typeof threshold === 'number' && threshold > 0 ? threshold : 1
      };
    } catch {
      return null;
    }
  }

  /**
   * Count recent occurrences of specific intent for threshold checking
   */
  private static async countRecentIntentOccurrences(leadId: string, intent: string): Promise<number> {
    try {
      const conversations = await storage.getConversationsByLead(leadId);
      if (!conversations.length) return 0;

      const recentMessages = await storage.getConversationMessages(conversations[0].id, 10);
      const leadMessages = recentMessages
        .filter(m => m.messageType === 'lead_msg')
        .map(m => m.content);

      let count = 0;
      for (const message of leadMessages) {
        const messageIntent = await detectIntentFromConversation([message]);
        if (messageIntent === intent) {
          count++;
        }
      }

      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Execute the actual handover process
   */
  private static async triggerHandover(
    leadId: string, 
    campaignId: string, 
    intent: string, 
    recipient?: string | null
  ): Promise<void> {
    // Log handover event
    await storage.logHandoverEvent({
      leadId,
      campaignId,
      intent,
      triggeredAt: new Date()
    });

    // If recipient is specified, could trigger external notifications here
    if (recipient) {
      logger.info('Handover event logged with recipient', { 
        leadId, 
        campaignId, 
        intent, 
        recipient 
      });
      
      // Future: Send notification to recipient
      // - Email notification
      // - Slack/Teams message
      // - CRM integration
      // - SMS notification
    }
  }
}

// Export the main function for easy import
export const { maybeTriggerIntentHandover } = IntentHandoverService;