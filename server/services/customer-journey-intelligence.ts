import { storage } from '../storage';
import type { Lead, Conversation, Campaign } from '@shared/schema';

/**
 * Customer Journey Intelligence Service
 * Advanced analytics for customer journey stages, churn prediction, and next best actions
 */

export interface CustomerJourneyAnalysis {
  journeyStages: JourneyStageAnalysis[];
  churnPredictions: ChurnPrediction[];
  nextBestActions: NextBestAction[];
  lifecycleOptimization: LifecycleOptimization;
  journeyHealthScore: number;
  conversionFunnelAnalysis: ConversionFunnelAnalysis;
}

export interface JourneyStageAnalysis {
  stage: JourneyStage;
  leadsInStage: number;
  averageTimeInStage: number; // days
  conversionRate: number; // to next stage
  dropoffRate: number;
  keyActivities: string[];
  commonExitReasons: string[];
  optimizationOpportunities: string[];
  stageHealth: 'excellent' | 'good' | 'needs_attention' | 'critical';
}

export interface ChurnPrediction {
  leadId: string;
  churnProbability: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  keyRiskFactors: string[];
  timeToChurn: number; // days
  interventionRecommendations: InterventionRecommendation[];
  confidenceScore: number;
  lastEngagement: Date;
}

export interface NextBestAction {
  leadId: string;
  currentStage: JourneyStage;
  recommendedActions: ActionRecommendation[];
  priority: 'immediate' | 'high' | 'medium' | 'low';
  expectedImpact: number; // 0-100
  urgencyScore: number; // 0-100
  personalizedContext: PersonalizedContext;
}

export interface ActionRecommendation {
  action: string;
  description: string;
  expectedOutcome: string;
  timeframe: string;
  effort: 'low' | 'medium' | 'high';
  successProbability: number;
  channel: 'email' | 'phone' | 'sms' | 'in_person';
  template?: string;
  followUpRequired: boolean;
}

export interface LifecycleOptimization {
  averageJourneyDuration: number; // days
  optimalJourneyPath: JourneyStage[];
  bottlenecks: Bottleneck[];
  accelerationOpportunities: AccelerationOpportunity[];
  retentionStrategies: RetentionStrategy[];
  crossSellOpportunities: CrossSellOpportunity[];
}

export interface ConversionFunnelAnalysis {
  stages: FunnelStage[];
  overallConversionRate: number;
  leakagePoints: LeakagePoint[];
  benchmarkComparison: BenchmarkComparison;
  improvementRecommendations: string[];
}

export interface JourneyStage {
  id: string;
  name: string;
  description: string;
  order: number;
  isTerminal: boolean;
}

export interface InterventionRecommendation {
  intervention: string;
  description: string;
  urgency: 'immediate' | 'within_24h' | 'within_week';
  expectedImpact: number;
  costToImplement: 'low' | 'medium' | 'high';
  successRate: number;
}

export interface PersonalizedContext {
  vehicleInterest: string[];
  communicationPreferences: string[];
  engagementHistory: EngagementSummary;
  demographicProfile: DemographicProfile;
  behaviorPatterns: BehaviorPattern[];
}

export interface Bottleneck {
  stage: string;
  impact: number; // percentage of leads affected
  averageDelay: number; // days
  primaryCauses: string[];
  resolutionStrategies: string[];
}

export interface AccelerationOpportunity {
  stage: string;
  potentialSpeedup: number; // days
  implementation: string;
  requiredResources: string[];
  expectedROI: number;
}

export interface RetentionStrategy {
  targetStage: string;
  strategy: string;
  expectedRetentionIncrease: number; // percentage
  implementationComplexity: 'low' | 'medium' | 'high';
  timeline: number; // days
}

export interface CrossSellOpportunity {
  leadId: string;
  primaryVehicle: string;
  opportunityType: 'service' | 'accessories' | 'extended_warranty' | 'additional_vehicle';
  description: string;
  estimatedValue: number;
  probability: number;
  bestTimeToApproach: Date;
}

export interface FunnelStage {
  name: string;
  leadsEntered: number;
  leadsExited: number;
  conversionRate: number;
  averageTime: number; // days
}

export interface LeakagePoint {
  stage: string;
  leakageRate: number; // percentage
  primaryReasons: string[];
  recoveryActions: string[];
  estimatedLostRevenue: number;
}

export interface BenchmarkComparison {
  industryAverage: number;
  topPerformers: number;
  yourPerformance: number;
  percentile: number;
}

export interface EngagementSummary {
  totalInteractions: number;
  lastInteraction: Date;
  averageResponseTime: number; // hours
  preferredChannels: string[];
  engagementTrend: 'increasing' | 'stable' | 'declining';
}

export interface DemographicProfile {
  age?: number;
  location?: string;
  income?: 'low' | 'medium' | 'high';
  familySize?: number;
  homeOwnership?: boolean;
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  context: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export class CustomerJourneyIntelligenceService {
  private readonly journeyStages: JourneyStage[] = [
    { id: 'awareness', name: 'Awareness', description: 'Initial interest or inquiry', order: 1, isTerminal: false },
    { id: 'interest', name: 'Interest', description: 'Active engagement and information gathering', order: 2, isTerminal: false },
    { id: 'consideration', name: 'Consideration', description: 'Serious consideration and comparison', order: 3, isTerminal: false },
    { id: 'intent', name: 'Purchase Intent', description: 'Clear intention to purchase', order: 4, isTerminal: false },
    { id: 'negotiation', name: 'Negotiation', description: 'Price and terms negotiation', order: 5, isTerminal: false },
    { id: 'purchase', name: 'Purchase', description: 'Completed purchase', order: 6, isTerminal: true },
    { id: 'churned', name: 'Churned', description: 'Lost opportunity', order: 7, isTerminal: true },
    { id: 'retention', name: 'Retention', description: 'Post-purchase relationship', order: 8, isTerminal: false }
  ];

  /**
   * Analyze complete customer journey for all leads
   */
  async analyzeCustomerJourney(): Promise<CustomerJourneyAnalysis> {
    const leads = await storage.getLeads();
    const conversations = await storage.getConversations();
    const campaigns = await storage.getCampaigns();

    // Classify leads into journey stages
    const stageClassifications = await this.classifyLeadsIntoStages(leads, conversations);
    
    // Analyze each journey stage
    const journeyStages = await this.analyzeJourneyStages(stageClassifications, conversations);
    
    // Predict churn for at-risk leads
    const churnPredictions = await this.predictChurn(leads, conversations);
    
    // Generate next best actions
    const nextBestActions = await this.generateNextBestActions(leads, conversations, stageClassifications);
    
    // Optimize lifecycle management
    const lifecycleOptimization = await this.optimizeLifecycle(stageClassifications, conversations);
    
    // Calculate journey health score
    const journeyHealthScore = this.calculateJourneyHealthScore(journeyStages);
    
    // Analyze conversion funnel
    const conversionFunnelAnalysis = await this.analyzeConversionFunnel(stageClassifications);

    return {
      journeyStages,
      churnPredictions,
      nextBestActions,
      lifecycleOptimization,
      journeyHealthScore,
      conversionFunnelAnalysis
    };
  }

  /**
   * Classify leads into journey stages using behavioral analysis
   */
  private async classifyLeadsIntoStages(leads: Lead[], conversations: Conversation[]): Promise<Map<string, JourneyStage>> {
    const classifications = new Map<string, JourneyStage>();

    for (const lead of leads) {
      const leadConversations = conversations.filter(c => c.leadId === lead.id);
      const stage = await this.determineLeadStage(lead, leadConversations);
      classifications.set(lead.id, stage);
    }

    return classifications;
  }

  /**
   * Determine individual lead's journey stage
   */
  private async determineLeadStage(lead: Lead, conversations: Conversation[]): Promise<JourneyStage> {
    // Check for terminal states first
    if (lead.status === 'converted') {
      return this.journeyStages.find(s => s.id === 'purchase')!;
    }
    
    if (lead.status === 'lost') {
      return this.journeyStages.find(s => s.id === 'churned')!;
    }

    // Analyze conversation content and engagement patterns
    const messages = conversations.flatMap(c => (c as any).messages || []);
    const leadMessages = messages.filter((m: any) => !m.isFromAI);
    const allContent = messages.map((m: any) => m.content.toLowerCase()).join(' ');

    // Stage classification logic based on content and behavior
    if (this.hasNegotiationIndicators(allContent)) {
      return this.journeyStages.find(s => s.id === 'negotiation')!;
    }
    
    if (this.hasPurchaseIntentIndicators(allContent)) {
      return this.journeyStages.find(s => s.id === 'intent')!;
    }
    
    if (this.hasConsiderationIndicators(allContent, leadMessages.length)) {
      return this.journeyStages.find(s => s.id === 'consideration')!;
    }
    
    if (this.hasInterestIndicators(allContent, leadMessages.length)) {
      return this.journeyStages.find(s => s.id === 'interest')!;
    }

    // Default to awareness stage
    return this.journeyStages.find(s => s.id === 'awareness')!;
  }

  /**
   * Analyze performance and characteristics of each journey stage
   */
  private async analyzeJourneyStages(
    stageClassifications: Map<string, JourneyStage>,
    conversations: Conversation[]
  ): Promise<JourneyStageAnalysis[]> {
    const stageAnalyses: JourneyStageAnalysis[] = [];

    for (const stage of this.journeyStages) {
      const leadsInStage = Array.from(stageClassifications.values()).filter(s => s.id === stage.id).length;
      
      if (leadsInStage === 0) {
        stageAnalyses.push(this.createEmptyStageAnalysis(stage));
        continue;
      }

      const stageLeadIds = Array.from(stageClassifications.entries())
        .filter(([_, stageId]) => stageId.id === stage.id)
        .map(([leadId, _]) => leadId);

      const stageConversations = conversations.filter(c => stageLeadIds.includes(c.leadId || ''));
      
      const analysis = await this.analyzeStagePerformance(stage, stageLeadIds, stageConversations);
      stageAnalyses.push(analysis);
    }

    return stageAnalyses;
  }

  /**
   * Predict churn probability for active leads
   */
  private async predictChurn(leads: Lead[], conversations: Conversation[]): Promise<ChurnPrediction[]> {
    const predictions: ChurnPrediction[] = [];

    for (const lead of leads) {
      if (lead.status === 'converted' || lead.status === 'lost') {
        continue; // Skip terminal states
      }

      const leadConversations = conversations.filter(c => c.leadId === lead.id);
      const churnPrediction = await this.calculateChurnProbability(lead, leadConversations);
      
      if (churnPrediction.churnProbability > 20) { // Only include leads with >20% churn risk
        predictions.push(churnPrediction);
      }
    }

    return predictions.sort((a, b) => b.churnProbability - a.churnProbability);
  }

  /**
   * Calculate churn probability for individual lead
   */
  private async calculateChurnProbability(lead: Lead, conversations: Conversation[]): Promise<ChurnPrediction> {
    let churnProbability = 0;
    const riskFactors: string[] = [];

    // Time since last interaction
    const lastInteraction = this.getLastInteractionDate(conversations);
    const daysSinceLastContact = lastInteraction ? 
      Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)) : 999;

    if (daysSinceLastContact > 14) {
      churnProbability += 30;
      riskFactors.push('No contact for over 2 weeks');
    } else if (daysSinceLastContact > 7) {
      churnProbability += 15;
      riskFactors.push('Limited recent engagement');
    }

    // Engagement quality decline
    const engagementTrend = this.analyzeEngagementTrend(conversations);
    if (engagementTrend === 'declining') {
      churnProbability += 25;
      riskFactors.push('Declining engagement pattern');
    }

    // Negative sentiment indicators
    const hasNegativeSentiment = this.detectNegativeSentiment(conversations);
    if (hasNegativeSentiment) {
      churnProbability += 20;
      riskFactors.push('Negative sentiment detected');
    }

    // Competitor mentions
    const hasCompetitorMentions = this.detectCompetitorMentions(conversations);
    if (hasCompetitorMentions) {
      churnProbability += 15;
      riskFactors.push('Competitor comparison activity');
    }

    // Price sensitivity
    const isPriceSensitive = this.detectPriceSensitivity(conversations);
    if (isPriceSensitive) {
      churnProbability += 10;
      riskFactors.push('High price sensitivity');
    }

    churnProbability = Math.min(100, churnProbability);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (churnProbability > 75) riskLevel = 'critical';
    else if (churnProbability > 50) riskLevel = 'high';
    else if (churnProbability > 25) riskLevel = 'medium';
    else riskLevel = 'low';

    const interventionRecommendations = this.generateInterventionRecommendations(riskLevel, riskFactors);
    const timeToChurn = this.estimateTimeToChurn(churnProbability, daysSinceLastContact);
    const confidenceScore = this.calculateChurnConfidence(conversations.length, riskFactors.length);

    return {
      leadId: lead.id,
      churnProbability,
      riskLevel,
      keyRiskFactors: riskFactors,
      timeToChurn,
      interventionRecommendations,
      confidenceScore,
      lastEngagement: lastInteraction || new Date(lead.createdAt!)
    };
  }

  /**
   * Generate personalized next best actions for leads
   */
  private async generateNextBestActions(
    leads: Lead[],
    conversations: Conversation[],
    stageClassifications: Map<string, JourneyStage>
  ): Promise<NextBestAction[]> {
    const nextBestActions: NextBestAction[] = [];

    for (const lead of leads) {
      if (lead.status === 'converted' || lead.status === 'lost') {
        continue; // Skip terminal states
      }

      const currentStage = stageClassifications.get(lead.id) || this.journeyStages[0];
      const leadConversations = conversations.filter(c => c.leadId === lead.id);
      
      const nextBestAction = await this.generateLeadNextBestAction(lead, leadConversations, currentStage);
      nextBestActions.push(nextBestAction);
    }

    return nextBestActions.sort((a, b) => {
      const priorityOrder = { 'immediate': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.urgencyScore - a.urgencyScore;
    });
  }

  /**
   * Generate next best action for individual lead
   */
  private async generateLeadNextBestAction(
    lead: Lead,
    conversations: Conversation[],
    currentStage: JourneyStage
  ): Promise<NextBestAction> {
    const personalizedContext = this.buildPersonalizedContext(lead, conversations);
    const urgencyScore = this.calculateUrgencyScore(lead, conversations, currentStage);
    
    let priority: 'immediate' | 'high' | 'medium' | 'low';
    if (urgencyScore > 80) priority = 'immediate';
    else if (urgencyScore > 60) priority = 'high';
    else if (urgencyScore > 40) priority = 'medium';
    else priority = 'low';

    const recommendedActions = this.generateStageSpecificActions(currentStage, personalizedContext, urgencyScore);
    const expectedImpact = this.calculateExpectedImpact(currentStage, recommendedActions, personalizedContext);

    return {
      leadId: lead.id,
      currentStage,
      recommendedActions,
      priority,
      expectedImpact,
      urgencyScore,
      personalizedContext
    };
  }

  /**
   * Generate stage-specific action recommendations
   */
  private generateStageSpecificActions(
    stage: JourneyStage,
    context: PersonalizedContext,
    urgencyScore: number
  ): ActionRecommendation[] {
    const actions: ActionRecommendation[] = [];

    switch (stage.id) {
      case 'awareness':
        actions.push({
          action: 'Send educational content',
          description: 'Provide vehicle comparison guide and buying tips',
          expectedOutcome: 'Increase product knowledge and engagement',
          timeframe: 'Within 2 days',
          effort: 'low',
          successProbability: 75,
          channel: 'email',
          template: 'automotive_buyer_guide',
          followUpRequired: true
        });
        break;

      case 'interest':
        actions.push({
          action: 'Schedule virtual walkthrough',
          description: 'Arrange personalized vehicle demonstration',
          expectedOutcome: 'Move to consideration stage',
          timeframe: 'Within 1 week',
          effort: 'medium',
          successProbability: 65,
          channel: 'phone',
          followUpRequired: true
        });
        break;

      case 'consideration':
        actions.push({
          action: 'Provide financing options',
          description: 'Send personalized financing calculations',
          expectedOutcome: 'Address purchase barriers',
          timeframe: 'Within 3 days',
          effort: 'low',
          successProbability: 80,
          channel: 'email',
          template: 'financing_options',
          followUpRequired: true
        });
        break;

      case 'intent':
        actions.push({
          action: 'Schedule test drive',
          description: 'Arrange in-person test drive experience',
          expectedOutcome: 'Progress to negotiation',
          timeframe: 'Within 2 days',
          effort: 'high',
          successProbability: 85,
          channel: 'phone',
          followUpRequired: false
        });
        break;

      case 'negotiation':
        actions.push({
          action: 'Present final offer',
          description: 'Provide best pricing with clear deadline',
          expectedOutcome: 'Close the deal',
          timeframe: 'Within 1 day',
          effort: 'high',
          successProbability: 70,
          channel: 'in_person',
          followUpRequired: false
        });
        break;
    }

    // Add urgency-based modifications
    if (urgencyScore > 70) {
      actions.forEach(action => {
        action.timeframe = action.timeframe.replace(/(\d+) day/, '1 day');
        action.timeframe = action.timeframe.replace(/(\d+) week/, '3 days');
      });
    }

    return actions;
  }

  /**
   * Optimize lifecycle management strategies
   */
  private async optimizeLifecycle(
    stageClassifications: Map<string, JourneyStage>,
    conversations: Conversation[]
  ): Promise<LifecycleOptimization> {
    const averageJourneyDuration = this.calculateAverageJourneyDuration(stageClassifications, conversations);
    const optimalJourneyPath = this.determineOptimalJourneyPath();
    const bottlenecks = await this.identifyBottlenecks(stageClassifications, conversations);
    const accelerationOpportunities = this.identifyAccelerationOpportunities(bottlenecks);
    const retentionStrategies = this.generateRetentionStrategies();
    const crossSellOpportunities = await this.identifyCrossSellOpportunities(stageClassifications);

    return {
      averageJourneyDuration,
      optimalJourneyPath,
      bottlenecks,
      accelerationOpportunities,
      retentionStrategies,
      crossSellOpportunities
    };
  }

  /**
   * Analyze conversion funnel performance
   */
  private async analyzeConversionFunnel(
    stageClassifications: Map<string, JourneyStage>
  ): Promise<ConversionFunnelAnalysis> {
    const stages = this.calculateFunnelStages(stageClassifications);
    const overallConversionRate = this.calculateOverallConversionRate(stages);
    const leakagePoints = this.identifyLeakagePoints(stages);
    const benchmarkComparison = this.getBenchmarkComparison(overallConversionRate);
    const improvementRecommendations = this.generateImprovementRecommendations(leakagePoints);

    return {
      stages,
      overallConversionRate,
      leakagePoints,
      benchmarkComparison,
      improvementRecommendations
    };
  }

  // Helper methods for journey stage analysis

  private hasNegotiationIndicators(content: string): boolean {
    const negotiationTerms = ['price', 'deal', 'discount', 'negotiate', 'offer', 'payment', 'financing terms'];
    return negotiationTerms.some(term => content.includes(term));
  }

  private hasPurchaseIntentIndicators(content: string): boolean {
    const intentTerms = ['ready to buy', 'want to purchase', 'when can I get', 'available inventory', 'test drive'];
    return intentTerms.some(term => content.includes(term));
  }

  private hasConsiderationIndicators(content: string, messageCount: number): boolean {
    const considerationTerms = ['compare', 'features', 'specifications', 'options', 'warranty'];
    return considerationTerms.some(term => content.includes(term)) || messageCount > 5;
  }

  private hasInterestIndicators(content: string, messageCount: number): boolean {
    const interestTerms = ['tell me more', 'information', 'details', 'interested', 'learn about'];
    return interestTerms.some(term => content.includes(term)) || messageCount > 2;
  }

  private createEmptyStageAnalysis(stage: JourneyStage): JourneyStageAnalysis {
    return {
      stage,
      leadsInStage: 0,
      averageTimeInStage: 0,
      conversionRate: 0,
      dropoffRate: 0,
      keyActivities: [],
      commonExitReasons: [],
      optimizationOpportunities: [`Implement strategies to guide leads into ${stage.name} stage`],
      stageHealth: 'needs_attention'
    };
  }

  private async analyzeStagePerformance(
    stage: JourneyStage,
    leadIds: string[],
    conversations: Conversation[]
  ): Promise<JourneyStageAnalysis> {
    const leadsInStage = leadIds.length;
    const averageTimeInStage = this.calculateAverageTimeInStage(leadIds, conversations);
    const conversionRate = this.calculateStageConversionRate(stage, leadIds);
    const dropoffRate = 100 - conversionRate;
    const keyActivities = this.identifyKeyStageActivities(stage, conversations);
    const commonExitReasons = this.identifyExitReasons(stage, conversations);
    const optimizationOpportunities = this.identifyStageOptimizationOpportunities(stage, conversionRate, dropoffRate);
    
    let stageHealth: 'excellent' | 'good' | 'needs_attention' | 'critical';
    if (conversionRate > 80) stageHealth = 'excellent';
    else if (conversionRate > 60) stageHealth = 'good';
    else if (conversionRate > 40) stageHealth = 'needs_attention';
    else stageHealth = 'critical';

    return {
      stage,
      leadsInStage,
      averageTimeInStage,
      conversionRate,
      dropoffRate,
      keyActivities,
      commonExitReasons,
      optimizationOpportunities,
      stageHealth
    };
  }

  private getLastInteractionDate(conversations: Conversation[]): Date | null {
    if (conversations.length === 0) return null;
    
    const lastConversation = conversations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    
    return new Date(lastConversation.updatedAt);
  }

  private analyzeEngagementTrend(conversations: Conversation[]): 'increasing' | 'stable' | 'declining' {
    if (conversations.length < 3) return 'stable';
    
    const recentConversations = conversations.slice(-3);
    const olderConversations = conversations.slice(0, -3);
    
    const recentActivity = recentConversations.length;
    const olderActivity = olderConversations.length / Math.max(1, olderConversations.length / 3);
    
    if (recentActivity > olderActivity * 1.2) return 'increasing';
    if (recentActivity < olderActivity * 0.8) return 'declining';
    return 'stable';
  }

  private detectNegativeSentiment(conversations: Conversation[]): boolean {
    const negativeTerms = ['not interested', 'disappointed', 'frustrated', 'cancel', 'stop', 'unsubscribe'];
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map((m: any) => m.content.toLowerCase())
      .join(' ');
    
    return negativeTerms.some(term => allContent.includes(term));
  }

  private detectCompetitorMentions(conversations: Conversation[]): boolean {
    const competitors = ['toyota', 'honda', 'ford', 'chevy', 'nissan', 'hyundai', 'kia'];
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map((m: any) => m.content.toLowerCase())
      .join(' ');
    
    return competitors.some(comp => allContent.includes(comp));
  }

  private detectPriceSensitivity(conversations: Conversation[]): boolean {
    const priceTerms = ['expensive', 'cheaper', 'better price', 'too much', 'budget', 'afford'];
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map((m: any) => m.content.toLowerCase())
      .join(' ');
    
    return priceTerms.some(term => allContent.includes(term));
  }

  private generateInterventionRecommendations(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    riskFactors: string[]
  ): InterventionRecommendation[] {
    const recommendations: InterventionRecommendation[] = [];

    if (riskLevel === 'critical') {
      recommendations.push({
        intervention: 'Immediate manager escalation',
        description: 'Have senior salesperson contact lead within 2 hours',
        urgency: 'immediate',
        expectedImpact: 75,
        costToImplement: 'high',
        successRate: 60
      });
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      recommendations.push({
        intervention: 'Personalized retention offer',
        description: 'Present exclusive pricing or incentive package',
        urgency: 'within_24h',
        expectedImpact: 65,
        costToImplement: 'medium',
        successRate: 55
      });
    }

    if (riskFactors.includes('Competitor comparison activity')) {
      recommendations.push({
        intervention: 'Competitive differentiation presentation',
        description: 'Schedule presentation highlighting unique advantages',
        urgency: 'within_week',
        expectedImpact: 50,
        costToImplement: 'low',
        successRate: 45
      });
    }

    return recommendations;
  }

  private estimateTimeToChurn(churnProbability: number, daysSinceLastContact: number): number {
    if (churnProbability > 75) return Math.max(1, 7 - daysSinceLastContact);
    if (churnProbability > 50) return Math.max(3, 14 - daysSinceLastContact);
    if (churnProbability > 25) return Math.max(7, 30 - daysSinceLastContact);
    return 30;
  }

  private calculateChurnConfidence(conversationCount: number, riskFactorCount: number): number {
    let confidence = 50; // Base confidence
    
    // More conversations provide better insights
    confidence += Math.min(30, conversationCount * 5);
    
    // More risk factors increase confidence in prediction
    confidence += Math.min(20, riskFactorCount * 8);
    
    return Math.min(95, confidence);
  }

  private buildPersonalizedContext(lead: Lead, conversations: Conversation[]): PersonalizedContext {
    const messages = conversations.flatMap(c => (c as any).messages || []);
    const engagementSummary = this.buildEngagementSummary(messages);
    
    return {
      vehicleInterest: [lead.vehicleInterest || 'General inquiry'],
      communicationPreferences: ['email'], // Would analyze from actual interactions
      engagementHistory: engagementSummary,
      demographicProfile: this.buildDemographicProfile(lead),
      behaviorPatterns: this.identifyBehaviorPatterns(messages)
    };
  }

  private calculateUrgencyScore(lead: Lead, conversations: Conversation[], stage: JourneyStage): number {
    let urgencyScore = 0;

    // Stage-based urgency
    const stageUrgency = { 'negotiation': 40, 'intent': 30, 'consideration': 20, 'interest': 15, 'awareness': 10 };
    urgencyScore += stageUrgency[stage.id as keyof typeof stageUrgency] || 10;

    // Time since last contact
    const lastInteraction = this.getLastInteractionDate(conversations);
    const daysSinceContact = lastInteraction ? 
      Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)) : 999;
    
    if (daysSinceContact > 7) urgencyScore += 20;
    if (daysSinceContact > 3) urgencyScore += 10;

    // Urgency indicators in content
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map((m: any) => m.content.toLowerCase())
      .join(' ');
    
    const urgencyTerms = ['urgent', 'asap', 'soon', 'quickly', 'this week', 'need now'];
    if (urgencyTerms.some(term => allContent.includes(term))) {
      urgencyScore += 30;
    }

    return Math.min(100, urgencyScore);
  }

  private calculateExpectedImpact(
    stage: JourneyStage,
    actions: ActionRecommendation[],
    context: PersonalizedContext
  ): number {
    const baseImpact = actions.reduce((sum, action) => sum + action.successProbability, 0) / actions.length;
    
    // Adjust based on stage
    const stageMultiplier = { 'negotiation': 1.3, 'intent': 1.2, 'consideration': 1.1, 'interest': 1.0, 'awareness': 0.9 };
    const multiplier = stageMultiplier[stage.id as keyof typeof stageMultiplier] || 1.0;
    
    return Math.round(baseImpact * multiplier);
  }

  private calculateJourneyHealthScore(stageAnalyses: JourneyStageAnalysis[]): number {
    const activeStages = stageAnalyses.filter(s => s.leadsInStage > 0);
    if (activeStages.length === 0) return 0;

    const healthScores = activeStages.map(stage => {
      const healthMap = { 'excellent': 100, 'good': 75, 'needs_attention': 50, 'critical': 25 };
      return healthMap[stage.stageHealth];
    });

    return Math.round(healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length);
  }

  // Additional helper methods would be implemented here for completeness...
  private calculateAverageTimeInStage(leadIds: string[], conversations: Conversation[]): number {
    // Mock implementation
    return Math.round(Math.random() * 14 + 3); // 3-17 days
  }

  private calculateStageConversionRate(stage: JourneyStage, leadIds: string[]): number {
    // Mock implementation
    const baseRates = { 'awareness': 65, 'interest': 70, 'consideration': 75, 'intent': 85, 'negotiation': 70 };
    return baseRates[stage.id as keyof typeof baseRates] || 50;
  }

  private identifyKeyStageActivities(stage: JourneyStage, conversations: Conversation[]): string[] {
    const activityMap = {
      'awareness': ['Initial inquiry', 'Information requests'],
      'interest': ['Product comparisons', 'Feature discussions'],
      'consideration': ['Pricing inquiries', 'Specification reviews'],
      'intent': ['Test drive scheduling', 'Financing discussions'],
      'negotiation': ['Price negotiations', 'Deal structuring']
    };
    return activityMap[stage.id as keyof typeof activityMap] || [];
  }

  private identifyExitReasons(stage: JourneyStage, conversations: Conversation[]): string[] {
    return ['Price concerns', 'Timing issues', 'Competitor preference', 'Changed requirements'];
  }

  private identifyStageOptimizationOpportunities(stage: JourneyStage, conversionRate: number, dropoffRate: number): string[] {
    const opportunities = [];
    
    if (conversionRate < 60) {
      opportunities.push('Improve stage-specific messaging');
      opportunities.push('Reduce friction points');
    }
    
    if (dropoffRate > 40) {
      opportunities.push('Implement retention interventions');
      opportunities.push('Address common objections');
    }
    
    return opportunities;
  }

  private buildEngagementSummary(messages: any[]): EngagementSummary {
    return {
      totalInteractions: messages.length,
      lastInteraction: messages.length > 0 ? new Date(messages[messages.length - 1].createdAt) : new Date(),
      averageResponseTime: 4.5, // Mock value
      preferredChannels: ['email'],
      engagementTrend: 'stable'
    };
  }

  private buildDemographicProfile(lead: Lead): DemographicProfile {
    return {
      // Mock demographic data
      age: undefined,
      location: undefined,
      income: 'medium',
      familySize: undefined,
      homeOwnership: undefined
    };
  }

  private identifyBehaviorPatterns(messages: any[]): BehaviorPattern[] {
    return [
      {
        pattern: 'Quick responder',
        frequency: 0.8,
        context: 'Responds within hours',
        impact: 'positive'
      }
    ];
  }

  private calculateAverageJourneyDuration(stageClassifications: Map<string, JourneyStage>, conversations: Conversation[]): number {
    return 45; // Mock: 45 days average
  }

  private determineOptimalJourneyPath(): JourneyStage[] {
    return this.journeyStages.filter(s => !s.isTerminal || s.id === 'purchase');
  }

  private async identifyBottlenecks(stageClassifications: Map<string, JourneyStage>, conversations: Conversation[]): Promise<Bottleneck[]> {
    return [
      {
        stage: 'consideration',
        impact: 35,
        averageDelay: 12,
        primaryCauses: ['Information overload', 'Decision paralysis'],
        resolutionStrategies: ['Simplify choices', 'Provide clear guidance']
      }
    ];
  }

  private identifyAccelerationOpportunities(bottlenecks: Bottleneck[]): AccelerationOpportunity[] {
    return bottlenecks.map(bottleneck => ({
      stage: bottleneck.stage,
      potentialSpeedup: Math.floor(bottleneck.averageDelay * 0.4),
      implementation: 'Streamlined decision process',
      requiredResources: ['Training', 'Tools', 'Process updates'],
      expectedROI: 25
    }));
  }

  private generateRetentionStrategies(): RetentionStrategy[] {
    return [
      {
        targetStage: 'consideration',
        strategy: 'Proactive follow-up program',
        expectedRetentionIncrease: 15,
        implementationComplexity: 'medium',
        timeline: 14
      }
    ];
  }

  private async identifyCrossSellOpportunities(stageClassifications: Map<string, JourneyStage>): Promise<CrossSellOpportunity[]> {
    return []; // Would analyze purchase history and preferences
  }

  private calculateFunnelStages(stageClassifications: Map<string, JourneyStage>): FunnelStage[] {
    const stageCounts = new Map<string, number>();
    
    for (const stage of Array.from(stageClassifications.values())) {
      const count = stageCounts.get(stage.id) || 0;
      stageCounts.set(stage.id, count + 1);
    }
    
    return this.journeyStages.map(stage => ({
      name: stage.name,
      leadsEntered: stageCounts.get(stage.id) || 0,
      leadsExited: 0, // Would calculate from historical data
      conversionRate: 0, // Would calculate from transitions
      averageTime: Math.random() * 14 + 3 // Mock
    }));
  }

  private calculateOverallConversionRate(stages: FunnelStage[]): number {
    const totalLeads = stages.reduce((sum, stage) => sum + stage.leadsEntered, 0);
    const convertedLeads = stages.find(s => s.name === 'Purchase')?.leadsEntered || 0;
    
    return totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;
  }

  private identifyLeakagePoints(stages: FunnelStage[]): LeakagePoint[] {
    return [
      {
        stage: 'consideration',
        leakageRate: 45,
        primaryReasons: ['Price objections', 'Timing concerns'],
        recoveryActions: ['Follow-up campaigns', 'Incentive offers'],
        estimatedLostRevenue: 125000
      }
    ];
  }

  private getBenchmarkComparison(performance: number): BenchmarkComparison {
    return {
      industryAverage: 18.5,
      topPerformers: 28.2,
      yourPerformance: performance,
      percentile: performance > 18.5 ? 75 : 45
    };
  }

  private generateImprovementRecommendations(leakagePoints: LeakagePoint[]): string[] {
    const recommendations = [];
    
    for (const point of leakagePoints) {
      recommendations.push(`Address ${point.stage} leakage: ${point.primaryReasons.join(', ')}`);
      recommendations.push(...point.recoveryActions);
    }
    
    return recommendations;
  }
}

export const customerJourneyIntelligenceService = new CustomerJourneyIntelligenceService();