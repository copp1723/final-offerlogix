import { storage } from '../../storage';
import { ConversationEvent, ConversationState, LeadMilestone } from './ConversationStateManager';

export interface LeadJourneyStage {
  id: string;
  name: string;
  description: string;
  order: number;
  milestones: LeadMilestone[];
  qualificationCriteria: QualificationCriteria[];
  progressWeight: number; // 0-100, how much this stage contributes to overall progress
}

export interface QualificationCriteria {
  type: 'message_count' | 'keyword_presence' | 'response_time' | 'engagement_score' | 'intent_signal';
  description: string;
  threshold?: number;
  keywords?: string[];
  required: boolean;
}

export interface LeadProgress {
  leadId: string;
  currentStage: LeadJourneyStage;
  completedStages: LeadJourneyStage[];
  nextStage?: LeadJourneyStage;
  overallProgress: number; // 0-100 percentage
  stageProgress: number; // 0-100 percentage within current stage
  qualificationScore: number; // 0-100 overall qualification score
  lastActivityAt: Date;
  timeInCurrentStage: number; // minutes
  velocityScore: number; // Progress speed indicator
}

export interface JourneyEvent {
  id: string;
  leadId: string;
  conversationId: string;
  eventType: 'stage_entered' | 'milestone_achieved' | 'criteria_met' | 'qualification_updated';
  stageId?: string;
  milestone?: LeadMilestone;
  criteriaType?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface LeadAnalytics {
  leadId: string;
  totalConversations: number;
  totalMessages: number;
  responseRate: number;
  averageResponseTime: number; // minutes
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
  qualificationSignals: string[];
  riskFactors: string[];
  nextBestAction: string;
  handoverReadiness: number; // 0-100 score
}

/**
 * Lead Journey Tracker - Manages lead progression through conversation stages
 */
export class LeadJourneyTracker {
  private journeyStages: LeadJourneyStage[] = [];

  constructor() {
    this.initializeJourneyStages();
  }

  /**
   * Initialize the standard lead journey stages
   */
  private initializeJourneyStages(): void {
    this.journeyStages = [
      {
        id: 'cold_lead',
        name: 'Cold Lead',
        description: 'Initial contact made, awaiting response',
        order: 1,
        milestones: [LeadMilestone.FIRST_CONTACT],
        qualificationCriteria: [
          {
            type: 'message_count',
            description: 'At least one outbound message sent',
            threshold: 1,
            required: true
          }
        ],
        progressWeight: 10
      },
      {
        id: 'responding_lead',
        name: 'Responding Lead',
        description: 'Lead has responded to initial outreach',
        order: 2,
        milestones: [LeadMilestone.FIRST_RESPONSE],
        qualificationCriteria: [
          {
            type: 'message_count',
            description: 'At least one inbound message received',
            threshold: 1,
            required: true
          },
          {
            type: 'response_time',
            description: 'Response within 48 hours',
            threshold: 2880, // 48 hours in minutes
            required: false
          }
        ],
        progressWeight: 25
      },
      {
        id: 'engaged_lead',
        name: 'Engaged Lead',
        description: 'Active two-way conversation established',
        order: 3,
        milestones: [LeadMilestone.MULTIPLE_EXCHANGES],
        qualificationCriteria: [
          {
            type: 'message_count',
            description: 'At least 3 exchanges (6 messages total)',
            threshold: 6,
            required: true
          },
          {
            type: 'engagement_score',
            description: 'Engagement score above 40',
            threshold: 40,
            required: true
          }
        ],
        progressWeight: 40
      },
      {
        id: 'interested_lead',
        name: 'Interested Lead',
        description: 'Expressed interest or intent signals',
        order: 4,
        milestones: [LeadMilestone.INTENT_SIGNAL],
        qualificationCriteria: [
          {
            type: 'keyword_presence',
            description: 'Interest keywords detected',
            keywords: ['interested', 'want', 'looking for', 'need', 'considering'],
            required: true
          },
          {
            type: 'intent_signal',
            description: 'Purchase or appointment intent detected',
            required: false
          }
        ],
        progressWeight: 65
      },
      {
        id: 'qualified_lead',
        name: 'Qualified Lead',
        description: 'Meets qualification criteria for handover',
        order: 5,
        milestones: [LeadMilestone.QUALIFICATION_COMPLETE],
        qualificationCriteria: [
          {
            type: 'keyword_presence',
            description: 'Qualification keywords present',
            keywords: ['buy', 'purchase', 'appointment', 'test drive', 'financing'],
            required: true
          },
          {
            type: 'engagement_score',
            description: 'High engagement score',
            threshold: 60,
            required: true
          }
        ],
        progressWeight: 85
      },
      {
        id: 'handover_ready',
        name: 'Handover Ready',
        description: 'Ready for human agent handover',
        order: 6,
        milestones: [LeadMilestone.HANDOVER_READY],
        qualificationCriteria: [
          {
            type: 'engagement_score',
            description: 'Sustained high engagement',
            threshold: 70,
            required: true
          }
        ],
        progressWeight: 100
      }
    ];
  }

  /**
   * Update lead progress based on conversation events
   */
  async updateLeadProgress(
    leadId: string,
    conversationId: string,
    event: ConversationEvent,
    metadata?: Record<string, any>
  ): Promise<LeadProgress | null> {
    try {
      const currentProgress = await this.getLeadProgress(leadId);
      const conversations = await storage.getConversationsByLead(leadId);
      
      // Calculate new progress based on event
      const updatedProgress = await this.calculateProgress(
        leadId,
        conversations,
        event,
        metadata
      );

      // Check for stage transitions
      const shouldTransition = this.shouldTransitionStage(currentProgress, updatedProgress);
      
      if (shouldTransition) {
        await this.transitionToNextStage(leadId, conversationId, updatedProgress);
      }

      // Record journey event
      await this.recordJourneyEvent({
        id: this.generateId(),
        leadId,
        conversationId,
        eventType: shouldTransition ? 'stage_entered' : 'qualification_updated',
        stageId: updatedProgress.currentStage.id,
        metadata: metadata || {},
        timestamp: new Date()
      });

      // Update analytics
      await this.updateLeadAnalytics(leadId);

      return updatedProgress;
    } catch (error) {
      console.error('Failed to update lead progress:', error);
      return null;
    }
  }

  /**
   * Get current lead progress
   */
  async getLeadProgress(leadId: string): Promise<LeadProgress> {
    try {
      const lead = await storage.getLead(leadId);
      const conversations = await storage.getConversationsByLead(leadId);
      
      if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
      }

      return await this.calculateProgress(leadId, conversations);
    } catch (error) {
      console.error('Failed to get lead progress:', error);
      // Return default progress for cold lead
      return {
        leadId,
        currentStage: this.journeyStages[0],
        completedStages: [],
        nextStage: this.journeyStages[1],
        overallProgress: 0,
        stageProgress: 0,
        qualificationScore: 0,
        lastActivityAt: new Date(),
        timeInCurrentStage: 0,
        velocityScore: 0
      };
    }
  }

  /**
   * Calculate lead progress based on conversations and events
   */
  private async calculateProgress(
    leadId: string,
    conversations: any[],
    recentEvent?: ConversationEvent,
    eventMetadata?: Record<string, any>
  ): Promise<LeadProgress> {
    // Get all messages for this lead
    const allMessages = await this.getAllLeadMessages(conversations);
    
    // Evaluate criteria for each stage
    const stageEvaluations = await Promise.all(
      this.journeyStages.map(stage => this.evaluateStage(stage, allMessages, conversations))
    );

    // Find current stage (highest completed stage)
    let currentStageIndex = 0;
    const completedStages: LeadJourneyStage[] = [];
    
    for (let i = 0; i < stageEvaluations.length; i++) {
      if (stageEvaluations[i].completed) {
        currentStageIndex = i;
        completedStages.push(this.journeyStages[i]);
      } else {
        break;
      }
    }

    const currentStage = this.journeyStages[currentStageIndex];
    const nextStage = this.journeyStages[currentStageIndex + 1] || undefined;
    
    // Calculate progress percentages
    const overallProgress = this.calculateOverallProgress(completedStages, currentStage);
    const stageProgress = stageEvaluations[currentStageIndex]?.progress || 0;
    
    // Calculate qualification score
    const qualificationScore = this.calculateQualificationScore(allMessages, conversations);
    
    // Calculate time in current stage
    const timeInCurrentStage = this.calculateTimeInStage(conversations, currentStage);
    
    // Calculate velocity score
    const velocityScore = this.calculateVelocityScore(allMessages, timeInCurrentStage);

    return {
      leadId,
      currentStage,
      completedStages,
      nextStage,
      overallProgress,
      stageProgress,
      qualificationScore,
      lastActivityAt: this.getLastActivityDate(allMessages),
      timeInCurrentStage,
      velocityScore
    };
  }

  /**
   * Get all messages for a lead across all conversations
   */
  private async getAllLeadMessages(conversations: any[]): Promise<any[]> {
    const allMessages: any[] = [];
    
    for (const conversation of conversations) {
      const messages = await storage.getConversationMessages(conversation.id);
      allMessages.push(...messages);
    }
    
    return allMessages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Evaluate if a stage is completed and calculate progress
   */
  private async evaluateStage(
    stage: LeadJourneyStage,
    messages: any[],
    conversations: any[]
  ): Promise<{ completed: boolean; progress: number; metCriteria: string[] }> {
    const metCriteria: string[] = [];
    let totalCriteria = stage.qualificationCriteria.length;
    let requiredCriteriaMet = 0;
    let totalRequiredCriteria = stage.qualificationCriteria.filter(c => c.required).length;

    for (const criteria of stage.qualificationCriteria) {
      const isMet = await this.evaluateCriteria(criteria, messages, conversations);
      
      if (isMet) {
        metCriteria.push(criteria.description);
        if (criteria.required) {
          requiredCriteriaMet++;
        }
      }
    }

    const completed = requiredCriteriaMet === totalRequiredCriteria;
    const progress = totalCriteria > 0 ? (metCriteria.length / totalCriteria) * 100 : 0;

    return { completed, progress, metCriteria };
  }

  /**
   * Evaluate individual qualification criteria
   */
  private async evaluateCriteria(
    criteria: QualificationCriteria,
    messages: any[],
    conversations: any[]
  ): Promise<boolean> {
    switch (criteria.type) {
      case 'message_count':
        return messages.length >= (criteria.threshold || 0);

      case 'keyword_presence':
        if (!criteria.keywords) return false;
        const allContent = messages.map(m => m.content.toLowerCase()).join(' ');
        return criteria.keywords.some(keyword => allContent.includes(keyword.toLowerCase()));

      case 'response_time':
        return this.evaluateResponseTime(messages, criteria.threshold || 0);

      case 'engagement_score':
        const engagementScore = this.calculateEngagementScore(messages);
        return engagementScore >= (criteria.threshold || 0);

      case 'intent_signal':
        return this.detectIntentSignals(messages);

      default:
        return false;
    }
  }

  /**
   * Evaluate response time criteria
   */
  private evaluateResponseTime(messages: any[], thresholdMinutes: number): boolean {
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    if (humanMessages.length === 0) return false;

    // Check if any response was within threshold
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].isFromAI === 0) {
        const timeDiff = new Date(messages[i].createdAt).getTime() - 
                        new Date(messages[i-1].createdAt).getTime();
        const minutes = timeDiff / (1000 * 60);
        
        if (minutes <= thresholdMinutes) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Calculate engagement score
   */
  private calculateEngagementScore(messages: any[]): number {
    if (messages.length === 0) return 0;
    
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const responseRate = humanMessages.length / Math.max(1, messages.length);
    
    // Factor in response timing
    let timeScore = 0;
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].isFromAI === 0) {
        const timeDiff = new Date(messages[i].createdAt).getTime() - 
                        new Date(messages[i-1].createdAt).getTime();
        const hours = timeDiff / (1000 * 60 * 60);
        
        if (hours < 1) timeScore += 20;
        else if (hours < 4) timeScore += 10;
        else if (hours < 24) timeScore += 5;
      }
    }
    
    const avgTimeScore = messages.length > 1 ? timeScore / (messages.length - 1) : 0;
    
    return Math.min(100, Math.round((responseRate * 50) + (avgTimeScore * 2.5)));
  }

  /**
   * Detect intent signals in messages
   */
  private detectIntentSignals(messages: any[]): boolean {
    const intentKeywords = [
      'interested in buying', 'want to purchase', 'ready to buy',
      'schedule appointment', 'test drive', 'when can I',
      'financing options', 'trade in', 'down payment'
    ];

    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const allContent = humanMessages.map(m => m.content.toLowerCase()).join(' ');
    
    return intentKeywords.some(signal => allContent.includes(signal));
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateOverallProgress(completedStages: LeadJourneyStage[], currentStage: LeadJourneyStage): number {
    const completedWeight = completedStages.reduce((sum, stage) => sum + stage.progressWeight, 0);
    const maxWeight = this.journeyStages[this.journeyStages.length - 1].progressWeight;
    
    return Math.min(100, Math.round((completedWeight / maxWeight) * 100));
  }

  /**
   * Calculate qualification score
   */
  private calculateQualificationScore(messages: any[], conversations: any[]): number {
    let score = 0;
    
    // Base score from message count
    score += Math.min(20, messages.length * 2);
    
    // Engagement score
    score += Math.min(30, this.calculateEngagementScore(messages));
    
    // Intent signals
    if (this.detectIntentSignals(messages)) {
      score += 25;
    }
    
    // Response quality (message length and content)
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const avgLength = humanMessages.reduce((sum, m) => sum + m.content.length, 0) / 
                     Math.max(1, humanMessages.length);
    
    if (avgLength > 50) score += 15; // Detailed responses
    if (avgLength > 100) score += 10; // Very detailed responses
    
    return Math.min(100, score);
  }

  /**
   * Calculate time in current stage
   */
  private calculateTimeInStage(conversations: any[], currentStage: LeadJourneyStage): number {
    if (conversations.length === 0) return 0;
    
    // Use first conversation creation time as stage entry time
    const stageEntryTime = new Date(conversations[0].createdAt);
    const now = new Date();
    
    return (now.getTime() - stageEntryTime.getTime()) / (1000 * 60);
  }

  /**
   * Calculate velocity score (how quickly lead is progressing)
   */
  private calculateVelocityScore(messages: any[], timeInStageMinutes: number): number {
    if (messages.length === 0 || timeInStageMinutes === 0) return 0;
    
    const messagesPerDay = (messages.length / Math.max(1, timeInStageMinutes)) * (24 * 60);
    
    if (messagesPerDay >= 2) return 100; // Very fast
    if (messagesPerDay >= 1) return 75;  // Fast
    if (messagesPerDay >= 0.5) return 50; // Normal
    if (messagesPerDay >= 0.2) return 25; // Slow
    
    return 10; // Very slow
  }

  /**
   * Get last activity date
   */
  private getLastActivityDate(messages: any[]): Date {
    if (messages.length === 0) return new Date();
    return new Date(messages[messages.length - 1].createdAt);
  }

  /**
   * Check if lead should transition to next stage
   */
  private shouldTransitionStage(currentProgress: LeadProgress, newProgress: LeadProgress): boolean {
    return currentProgress.currentStage.id !== newProgress.currentStage.id;
  }

  /**
   * Transition lead to next stage
   */
  private async transitionToNextStage(
    leadId: string,
    conversationId: string,
    progress: LeadProgress
  ): Promise<void> {
    try {
      console.log(`Lead ${leadId} transitioning to stage: ${progress.currentStage.name}`);
      
      // Record milestone achievement
      if (progress.currentStage.milestones.length > 0) {
        for (const milestone of progress.currentStage.milestones) {
          await this.recordJourneyEvent({
            id: this.generateId(),
            leadId,
            conversationId,
            eventType: 'milestone_achieved',
            milestone,
            metadata: { stage: progress.currentStage.id },
            timestamp: new Date()
          });
        }
      }

      // Update lead status if applicable
      await this.updateLeadStatus(leadId, progress.currentStage);
    } catch (error) {
      console.error('Failed to transition stage:', error);
    }
  }

  /**
   * Update lead status based on journey stage
   */
  private async updateLeadStatus(leadId: string, stage: LeadJourneyStage): Promise<void> {
    const statusMapping = {
      'cold_lead': 'contacted',
      'responding_lead': 'contacted',
      'engaged_lead': 'engaged',
      'interested_lead': 'interested',
      'qualified_lead': 'qualified',
      'handover_ready': 'qualified'
    };

    const newStatus = statusMapping[stage.id as keyof typeof statusMapping] || 'new';
    
    try {
      await storage.updateLead(leadId, { status: newStatus });
    } catch (error) {
      console.error('Failed to update lead status:', error);
    }
  }

  /**
   * Record journey event
   */
  private async recordJourneyEvent(event: JourneyEvent): Promise<void> {
    try {
      // In production, this would be stored in a journey_events table
      console.log('Journey event recorded:', event);
    } catch (error) {
      console.error('Failed to record journey event:', error);
    }
  }

  /**
   * Update lead analytics
   */
  private async updateLeadAnalytics(leadId: string): Promise<LeadAnalytics | null> {
    try {
      const lead = await storage.getLead(leadId);
      const conversations = await storage.getConversationsByLead(leadId);
      const allMessages = await this.getAllLeadMessages(conversations);
      
      if (!lead) return null;

      const humanMessages = allMessages.filter(m => m.isFromAI === 0);
      const totalMessages = allMessages.length;
      
      const analytics: LeadAnalytics = {
        leadId,
        totalConversations: conversations.length,
        totalMessages,
        responseRate: totalMessages > 0 ? (humanMessages.length / totalMessages) * 100 : 0,
        averageResponseTime: this.calculateAverageResponseTime(allMessages),
        engagementTrend: this.calculateEngagementTrend(allMessages),
        qualificationSignals: this.extractQualificationSignals(humanMessages),
        riskFactors: this.identifyRiskFactors(allMessages, conversations),
        nextBestAction: this.determineNextBestAction(allMessages, conversations),
        handoverReadiness: this.calculateHandoverReadiness(allMessages, conversations)
      };

      return analytics;
    } catch (error) {
      console.error('Failed to update lead analytics:', error);
      return null;
    }
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(messages: any[]): number {
    const responseTimes: number[] = [];
    
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].isFromAI === 0) {
        const timeDiff = new Date(messages[i].createdAt).getTime() - 
                        new Date(messages[i-1].createdAt).getTime();
        responseTimes.push(timeDiff / (1000 * 60));
      }
    }
    
    return responseTimes.length > 0 ? 
           responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
  }

  /**
   * Calculate engagement trend
   */
  private calculateEngagementTrend(messages: any[]): 'increasing' | 'stable' | 'decreasing' {
    if (messages.length < 4) return 'stable';
    
    const recent = messages.slice(-3);
    const earlier = messages.slice(-6, -3);
    
    const recentEngagement = this.calculateEngagementScore(recent);
    const earlierEngagement = this.calculateEngagementScore(earlier);
    
    if (recentEngagement > earlierEngagement + 10) return 'increasing';
    if (recentEngagement < earlierEngagement - 10) return 'decreasing';
    return 'stable';
  }

  /**
   * Extract qualification signals
   */
  private extractQualificationSignals(humanMessages: any[]): string[] {
    const signals: string[] = [];
    const allContent = humanMessages.map(m => m.content.toLowerCase()).join(' ');
    
    const signalPatterns = {
      'purchase_intent': ['buy', 'purchase', 'get this car'],
      'appointment_request': ['appointment', 'schedule', 'meet', 'visit'],
      'test_drive_request': ['test drive', 'drive the car', 'try it out'],
      'financing_inquiry': ['financing', 'payment', 'loan', 'lease'],
      'timeline_urgency': ['soon', 'quickly', 'this week', 'asap'],
      'comparison_shopping': ['compare', 'other dealers', 'best price']
    };

    Object.entries(signalPatterns).forEach(([signal, keywords]) => {
      if (keywords.some(keyword => allContent.includes(keyword))) {
        signals.push(signal);
      }
    });

    return signals;
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(messages: any[], conversations: any[]): string[] {
    const risks: string[] = [];
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    
    // Low response rate
    if (humanMessages.length / Math.max(1, messages.length) < 0.3) {
      risks.push('low_response_rate');
    }
    
    // Long gaps in communication
    const lastActivity = messages.length > 0 ? 
      new Date(messages[messages.length - 1].createdAt) : new Date();
    const hoursSinceLastActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastActivity > 72) {
      risks.push('communication_gap');
    }
    
    // Negative sentiment (simple keyword detection)
    const allContent = humanMessages.map(m => m.content.toLowerCase()).join(' ');
    const negativeKeywords = ['not interested', 'too expensive', 'stop calling', 'remove me'];
    
    if (negativeKeywords.some(keyword => allContent.includes(keyword))) {
      risks.push('negative_sentiment');
    }

    return risks;
  }

  /**
   * Determine next best action
   */
  private determineNextBestAction(messages: any[], conversations: any[]): string {
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const lastMessage = messages[messages.length - 1];
    
    if (!lastMessage) return 'send_initial_contact';
    
    if (lastMessage.isFromAI === 1) {
      return 'wait_for_response';
    }
    
    const recentContent = humanMessages.slice(-2).map(m => m.content.toLowerCase()).join(' ');
    
    if (recentContent.includes('appointment') || recentContent.includes('schedule')) {
      return 'schedule_appointment';
    }
    
    if (recentContent.includes('price') || recentContent.includes('cost')) {
      return 'provide_pricing';
    }
    
    if (recentContent.includes('test drive')) {
      return 'arrange_test_drive';
    }
    
    if (humanMessages.length >= 3) {
      return 'qualify_for_handover';
    }
    
    return 'continue_engagement';
  }

  /**
   * Calculate handover readiness score
   */
  private calculateHandoverReadiness(messages: any[], conversations: any[]): number {
    let score = 0;
    
    // Message count factor
    score += Math.min(20, messages.length * 2);
    
    // Engagement score factor
    score += Math.min(30, this.calculateEngagementScore(messages) * 0.3);
    
    // Qualification signals factor
    const humanMessages = messages.filter(m => m.isFromAI === 0);
    const qualificationSignals = this.extractQualificationSignals(humanMessages);
    score += Math.min(30, qualificationSignals.length * 10);
    
    // Intent signals factor
    if (this.detectIntentSignals(messages)) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `journey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get lead journey dashboard data
   */
  async getLeadJourneyDashboard(leadId: string): Promise<any> {
    try {
      const progress = await this.getLeadProgress(leadId);
      const analytics = await this.updateLeadAnalytics(leadId);
      
      return {
        progress,
        analytics,
        stagesOverview: this.journeyStages.map(stage => ({
          ...stage,
          isCompleted: progress.completedStages.some(completed => completed.id === stage.id),
          isCurrent: progress.currentStage.id === stage.id
        })),
        recommendations: this.generateRecommendations(progress, analytics)
      };
    } catch (error) {
      console.error('Failed to get lead journey dashboard:', error);
      return null;
    }
  }

  /**
   * Generate recommendations based on progress and analytics
   */
  private generateRecommendations(progress: LeadProgress, analytics: LeadAnalytics | null): string[] {
    const recommendations: string[] = [];
    
    if (!analytics) return recommendations;
    
    if (analytics.responseRate < 30) {
      recommendations.push('Consider adjusting messaging approach to increase engagement');
    }
    
    if (analytics.averageResponseTime > 1440) { // 24 hours
      recommendations.push('Follow up more frequently to maintain momentum');
    }
    
    if (analytics.qualificationSignals.includes('purchase_intent') && progress.currentStage.order < 5) {
      recommendations.push('Fast-track to qualification stage due to purchase intent');
    }
    
    if (analytics.handoverReadiness >= 70) {
      recommendations.push('Ready for human agent handover');
    }
    
    if (analytics.riskFactors.includes('communication_gap')) {
      recommendations.push('Re-engagement campaign recommended due to communication gap');
    }
    
    return recommendations;
  }

  /**
   * Get complete lead journey data
   */
  async getLeadJourney(leadId: string): Promise<any> {
    try {
      const progress = await this.getLeadProgress(leadId);
      const analytics = await this.updateLeadAnalytics(leadId);
      const dashboard = await this.getLeadJourneyDashboard(leadId);
      
      return {
        leadId,
        progress,
        analytics,
        dashboard,
        timeline: this.generateTimeline(progress),
        summary: this.generateJourneySummary(progress, analytics)
      };
    } catch (error) {
      console.error('Failed to get lead journey:', error);
      return null;
    }
  }

  /**
   * Generate journey timeline
   */
  private generateTimeline(progress: LeadProgress): any[] {
    const timeline = [];
    
    // Add completed stages to timeline
    for (const stage of progress.completedStages) {
      timeline.push({
        type: 'stage_completed',
        stage: stage.name,
        timestamp: new Date(), // In production, would use actual completion time
        description: `Completed ${stage.name} stage`
      });
    }
    
    // Add current stage
    timeline.push({
      type: 'current_stage',
      stage: progress.currentStage.name,
      timestamp: new Date(),
      description: `Currently in ${progress.currentStage.name} stage`,
      progress: progress.stageProgress
    });
    
    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate journey summary
   */
  private generateJourneySummary(progress: LeadProgress, analytics: LeadAnalytics | null): string {
    if (!analytics) {
      return `Lead is in ${progress.currentStage.name} stage with ${progress.overallProgress}% overall progress.`;
    }
    
    return `Lead is in ${progress.currentStage.name} stage with ${progress.overallProgress}% overall progress. ` +
           `${analytics.totalMessages} messages exchanged across ${analytics.totalConversations} conversations. ` +
           `Engagement trend is ${analytics.engagementTrend} with ${analytics.responseRate}% response rate.`;
  }
}

export const leadJourneyTracker = new LeadJourneyTracker();