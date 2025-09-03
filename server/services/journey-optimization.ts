import { storage } from '../storage';
import type { Lead, Conversation, Campaign } from '../../shared/schema';

export interface JourneyOptimization {
  leadId: string;
  currentStage: JourneyStage;
  nextBestActions: ActionRecommendation[];
  recommendedContent: ContentRecommendation[];
  estimatedTimeToConversion: number; // days
  stageProgress: number; // 0-100 percentage through current stage
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActionRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  expectedImpact: number; // 0-100
  timeframe: string;
}

export interface ContentRecommendation {
  contentType: 'email' | 'call' | 'text' | 'appointment';
  subject: string;
  keyPoints: string[];
  timing: string;
  priority: 'high' | 'medium' | 'low';
}

export type JourneyStage = 
  | 'awareness'      // Just discovered/first contact
  | 'interest'       // Showing engagement, asking questions  
  | 'consideration'  // Comparing options, discussing details
  | 'evaluation'     // Serious consideration, financing discussions
  | 'decision'       // Ready to purchase, final negotiations
  | 'conversion'     // Completed purchase
  | 'at_risk'        // Showing disengagement signs
  | 'lost';          // No longer interested

export class JourneyOptimizationService {
  /**
   * Get comprehensive journey optimization for a lead
   */
  async getJourneyOptimization(leadId: string): Promise<JourneyOptimization> {
    const lead = await storage.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const conversations = await this.getLeadConversations(leadId);
    
    const currentStage = this.analyzeJourneyStage(lead, conversations);
    const nextBestActions = this.generateNextBestActions(lead, conversations, currentStage);
    const recommendedContent = this.generateContentRecommendations(lead, currentStage);
    const estimatedTimeToConversion = this.estimateTimeToConversion(currentStage, conversations);
    const stageProgress = this.calculateStageProgress(lead, conversations, currentStage);
    const urgencyLevel = this.assessUrgencyLevel(lead, conversations);

    return {
      leadId,
      currentStage,
      nextBestActions,
      recommendedContent,
      estimatedTimeToConversion,
      stageProgress,
      urgencyLevel
    };
  }

  /**
   * Get next best actions for a specific lead
   */
  async getNextBestActions(leadId: string): Promise<ActionRecommendation[]> {
    const optimization = await this.getJourneyOptimization(leadId);
    return optimization.nextBestActions;
  }

  /**
   * Analyze current journey stage based on lead data and conversations
   */
  private analyzeJourneyStage(lead: Lead, conversations: Conversation[]): JourneyStage {
    const responseCount = conversations.reduce((sum, c) => 
      sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0), 0
    );

    const allMessages = conversations.flatMap(c => (c as any).messages || []);
    const messageText = allMessages
      .filter((m: any) => !m.isFromAI)
      .map((m: any) => m.content?.toLowerCase() || '')
      .join(' ');

    // Check for disengagement first
    if (this.showsDisengagementSigns(conversations)) {
      return 'at_risk';
    }

    // Check for lost lead indicators
    if (this.isLostLead(conversations)) {
      return 'lost';
    }

    // Check for conversion indicators
    if (this.showsConversionSigns(messageText)) {
      return 'decision';
    }

    // Check for evaluation stage
    if (this.showsEvaluationSigns(messageText)) {
      return 'evaluation';
    }

    // Check for consideration stage
    if (this.showsConsiderationSigns(messageText, responseCount)) {
      return 'consideration';
    }

    // Check for interest stage
    if (this.showsInterestSigns(responseCount, messageText)) {
      return 'interest';
    }

    // Default to awareness stage
    return 'awareness';
  }

  /**
   * Generate next best actions based on journey stage
   */
  private generateNextBestActions(lead: Lead, conversations: Conversation[], stage: JourneyStage): ActionRecommendation[] {
    const actions: ActionRecommendation[] = [];

    switch (stage) {
      case 'awareness':
        actions.push(
          {
            action: 'Send personalized introduction email',
            priority: 'high',
            reasoning: 'Establish connection and provide value',
            expectedImpact: 75,
            timeframe: 'Within 24 hours'
          },
          {
            action: 'Share vehicle information relevant to their interest',
            priority: 'medium',
            reasoning: 'Build interest with targeted content',
            expectedImpact: 60,
            timeframe: 'Within 2-3 days'
          }
        );
        break;

      case 'interest':
        actions.push(
          {
            action: 'Follow up on their specific questions',
            priority: 'high',
            reasoning: 'Maintain engagement momentum',
            expectedImpact: 80,
            timeframe: 'Within 4-6 hours'
          },
          {
            action: 'Provide vehicle comparison information',
            priority: 'medium',
            reasoning: 'Help them evaluate options',
            expectedImpact: 65,
            timeframe: 'Within 1-2 days'
          }
        );
        break;

      case 'consideration':
        actions.push(
          {
            action: 'Schedule phone call or video chat',
            priority: 'high',
            reasoning: 'Personal touch at critical decision point',
            expectedImpact: 85,
            timeframe: 'Within 12 hours'
          },
          {
            action: 'Send financing options and incentives',
            priority: 'high',
            reasoning: 'Address practical purchase considerations',
            expectedImpact: 78,
            timeframe: 'Within 24 hours'
          }
        );
        break;

      case 'evaluation':
        actions.push(
          {
            action: 'Schedule test drive appointment',
            priority: 'high',
            reasoning: 'Convert interest into physical experience',
            expectedImpact: 90,
            timeframe: 'Within 6 hours'
          },
          {
            action: 'Provide final pricing and incentives',
            priority: 'high',
            reasoning: 'Address final purchase barriers',
            expectedImpact: 85,
            timeframe: 'Immediately'
          }
        );
        break;

      case 'decision':
        actions.push(
          {
            action: 'Immediate sales team handoff',
            priority: 'high',
            reasoning: 'Ready to close - needs immediate attention',
            expectedImpact: 95,
            timeframe: 'Immediately'
          },
          {
            action: 'Prepare purchase paperwork',
            priority: 'high',
            reasoning: 'Streamline closing process',
            expectedImpact: 80,
            timeframe: 'Within 1 hour'
          }
        );
        break;

      case 'at_risk':
        actions.push(
          {
            action: 'Personal outreach from sales manager',
            priority: 'high',
            reasoning: 'Salvage relationship with senior attention',
            expectedImpact: 70,
            timeframe: 'Within 2 hours'
          },
          {
            action: 'Special retention offer',
            priority: 'medium',
            reasoning: 'Provide additional incentive to re-engage',
            expectedImpact: 60,
            timeframe: 'Within 24 hours'
          }
        );
        break;

      case 'lost':
        actions.push(
          {
            action: 'Add to long-term nurture campaign',
            priority: 'low',
            reasoning: 'Stay top-of-mind for future opportunities',
            expectedImpact: 30,
            timeframe: 'Within 1 week'
          }
        );
        break;

      default:
        actions.push(
          {
            action: 'Send general follow-up email',
            priority: 'medium',
            reasoning: 'Maintain contact and gauge interest',
            expectedImpact: 50,
            timeframe: 'Within 24 hours'
          }
        );
    }

    return actions;
  }

  /**
   * Generate content recommendations based on journey stage
   */
  private generateContentRecommendations(lead: Lead, stage: JourneyStage): ContentRecommendation[] {
    const recommendations: ContentRecommendation[] = [];
    const vehicleInterest = lead.vehicleInterest || 'vehicle';

    switch (stage) {
      case 'awareness':
        recommendations.push({
          contentType: 'email',
          subject: `Welcome! Let's find your perfect ${vehicleInterest}`,
          keyPoints: [
            'Personal introduction from your automotive specialist',
            'Overview of available inventory matching their interest',
            'Invitation to schedule a conversation'
          ],
          timing: 'Send within 24 hours',
          priority: 'high'
        });
        break;

      case 'interest':
        recommendations.push({
          contentType: 'email',
          subject: `${vehicleInterest} details and options`,
          keyPoints: [
            'Detailed specifications and features',
            'Available colors and trim levels',
            'Comparison with similar models'
          ],
          timing: 'Send within 2-3 days of last interaction',
          priority: 'high'
        });
        break;

      case 'consideration':
        recommendations.push({
          contentType: 'call',
          subject: 'Personal consultation call',
          keyPoints: [
            'Discuss specific needs and preferences',
            'Answer detailed questions',
            'Schedule test drive if appropriate'
          ],
          timing: 'Schedule within 12 hours',
          priority: 'high'
        });
        break;

      case 'evaluation':
        recommendations.push({
          contentType: 'appointment',
          subject: 'Test drive appointment',
          keyPoints: [
            'Schedule convenient test drive time',
            'Prepare vehicle for demonstration',
            'Have financing options ready'
          ],
          timing: 'Schedule within 6 hours',
          priority: 'high'
        });
        break;

      case 'at_risk':
        recommendations.push({
          contentType: 'call',
          subject: 'Personal check-in call',
          keyPoints: [
            'Address any concerns or objections',
            'Understand what might have changed',
            'Offer additional support or incentives'
          ],
          timing: 'Call within 2 hours',
          priority: 'high'
        });
        break;
    }

    return recommendations;
  }

  /**
   * Estimate time to conversion based on current stage and engagement
   */
  private estimateTimeToConversion(stage: JourneyStage, conversations: Conversation[]): number {
    const engagementLevel = this.calculateEngagementLevel(conversations);
    
    const baseEstimates: Record<JourneyStage, number> = {
      'awareness': 21,
      'interest': 14,
      'consideration': 7,
      'evaluation': 3,
      'decision': 1,
      'conversion': 0,
      'at_risk': 30,
      'lost': -1
    };

    let estimate = baseEstimates[stage] || 14;

    // Adjust based on engagement level
    if (engagementLevel > 0.8) {
      estimate = Math.round(estimate * 0.7); // High engagement shortens timeline
    } else if (engagementLevel < 0.3) {
      estimate = Math.round(estimate * 1.5); // Low engagement lengthens timeline
    }

    return Math.max(0, estimate);
  }

  /**
   * Calculate progress through current stage (0-100%)
   */
  private calculateStageProgress(lead: Lead, conversations: Conversation[], stage: JourneyStage): number {
    const responseCount = conversations.reduce((sum, c) => 
      sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0), 0
    );

    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(lead.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
    );

    let progress = 0;

    // Base progress on responses and time
    progress += Math.min(50, responseCount * 10); // Up to 50% for responses
    progress += Math.min(30, daysSinceCreated * 2);  // Up to 30% for time
    
    // Additional stage-specific indicators
    if (stage === 'consideration' || stage === 'evaluation') {
      progress += 20; // Advanced stages get bonus progress
    }

    return Math.min(100, Math.max(0, progress));
  }

  /**
   * Assess urgency level based on lead behavior and stage
   */
  private assessUrgencyLevel(lead: Lead, conversations: Conversation[]): 'low' | 'medium' | 'high' | 'critical' {
    const allMessages = conversations.flatMap(c => (c as any).messages || []);
    const messageText = allMessages
      .filter((m: any) => !m.isFromAI)
      .map((m: any) => m.content?.toLowerCase() || '')
      .join(' ');

    // Critical urgency indicators
    if (messageText.includes('today') || 
        messageText.includes('this week') ||
        messageText.includes('ready to buy') ||
        messageText.includes('need immediately')) {
      return 'critical';
    }

    // High urgency indicators
    if (messageText.includes('soon') ||
        messageText.includes('next week') ||
        messageText.includes('financing approved') ||
        messageText.includes('test drive')) {
      return 'high';
    }

    // Medium urgency - regular engagement
    const responseCount = conversations.reduce((sum, c) => 
      sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0), 0
    );

    if (responseCount >= 3) {
      return 'medium';
    }

    return 'low';
  }

  // Helper methods for stage analysis
  private showsDisengagementSigns(conversations: Conversation[]): boolean {
    if (!conversations.length) return false;

    const latestConversation = conversations.sort((a, b) => 
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
    )[0];

    const daysSinceLastActivity = Math.floor(
      (Date.now() - new Date(latestConversation.updatedAt || latestConversation.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceLastActivity > 14; // No activity for 2+ weeks
  }

  private isLostLead(conversations: Conversation[]): boolean {
    const allMessages = conversations.flatMap(c => (c as any).messages || []);
    const messageText = allMessages
      .filter((m: any) => !m.isFromAI)
      .map((m: any) => m.content?.toLowerCase() || '')
      .join(' ');

    return messageText.includes('not interested') ||
           messageText.includes('already purchased') ||
           messageText.includes('remove me') ||
           messageText.includes('unsubscribe');
  }

  private showsConversionSigns(messageText: string): boolean {
    return messageText.includes('ready to buy') ||
           messageText.includes('want to purchase') ||
           messageText.includes('make a deal') ||
           messageText.includes('sign paperwork');
  }

  private showsEvaluationSigns(messageText: string): boolean {
    return messageText.includes('test drive') ||
           messageText.includes('financing') ||
           messageText.includes('payment') ||
           messageText.includes('trade value') ||
           messageText.includes('final price');
  }

  private showsConsiderationSigns(messageText: string, responseCount: number): boolean {
    return responseCount >= 3 &&
           (messageText.includes('compare') ||
            messageText.includes('options') ||
            messageText.includes('features') ||
            messageText.includes('specifications'));
  }

  private showsInterestSigns(responseCount: number, messageText: string): boolean {
    return responseCount >= 1 &&
           (messageText.includes('tell me more') ||
            messageText.includes('interested') ||
            messageText.includes('availability') ||
            messageText.includes('price'));
  }

  private calculateEngagementLevel(conversations: Conversation[]): number {
    if (!conversations.length) return 0;

    const responseCount = conversations.reduce((sum, c) => 
      sum + ((c as any).messages?.filter((m: any) => !m.isFromAI)?.length || 0), 0
    );

    const avgResponseLength = conversations.reduce((sum, c) => {
      const messages = (c as any).messages || [];
      const userMessages = messages.filter((m: any) => !m.isFromAI);
      const totalLength = userMessages.reduce((len: number, m: any) => len + (m.content?.length || 0), 0);
      return sum + (userMessages.length > 0 ? totalLength / userMessages.length : 0);
    }, 0) / Math.max(1, conversations.length);

    // Score based on response count and message depth
    let score = Math.min(0.6, responseCount * 0.1); // Up to 60% for responses
    score += Math.min(0.4, avgResponseLength / 250); // Up to 40% for message depth

    return Math.min(1, score);
  }

  private async getLeadConversations(leadId: string): Promise<Conversation[]> {
    const conversations = await storage.getConversations();
    return conversations.filter(c => c.leadId === leadId);
  }
}

export const journeyOptimizationService = new JourneyOptimizationService();
