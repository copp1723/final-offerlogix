import { storage } from '../storage';
import type { Lead, Conversation } from '@shared/schema';
import { leadScoringService, type LeadScore, type ScoringProfile } from './lead-scoring';

/**
 * Advanced Lead Scoring Engine with Predictive Analytics
 * Enhances the existing automotive-focused lead scoring with ML-driven insights
 */

export interface PredictiveLeadScore extends LeadScore {
  lifetimeValue: number;
  conversionProbability: number;
  churRisk: number;
  optimalContactTime: Date | null;
  recommendedActions: string[];
  competitorThreats: string[];
  seasonalAdjustment: number;
}

export interface LeadLifetimeValue {
  predicted: number;
  confidence: number;
  factors: {
    vehicleType: number;
    financialCapacity: number;
    engagementQuality: number;
    demographicProfile: number;
    seasonality: number;
  };
  timeline: {
    shortTerm: number;   // 0-6 months
    mediumTerm: number;  // 6-18 months
    longTerm: number;    // 18+ months
  };
}

export interface ConversionPrediction {
  probability: number;
  confidence: number;
  timeFrame: number; // days to conversion
  keyFactors: string[];
  blockers: string[];
  nextBestActions: string[];
}

export interface CompetitorAnalysis {
  threatLevel: 'low' | 'medium' | 'high';
  mentionedCompetitors: string[];
  competitiveAdvantages: string[];
  riskFactors: string[];
  retentionStrategies: string[];
}

export class AdvancedLeadScoringService {
  private baseService = leadScoringService;
  
  /**
   * Calculate comprehensive predictive lead score
   */
  async calculatePredictiveLeadScore(leadId: string, profileId?: string): Promise<PredictiveLeadScore> {
    // Get base score from existing service
    const baseScore = await this.baseService.calculateLeadScore(leadId, profileId);
    
    // Calculate advanced predictive metrics
    const [ltv, conversionPrediction, competitorAnalysis, optimalTiming] = await Promise.all([
      this.calculateLifetimeValue(leadId),
      this.predictConversion(leadId),
      this.analyzeCompetitorThreats(leadId),
      this.determineOptimalContactTime(leadId)
    ]);

    const churnRisk = await this.calculateChurnRisk(leadId);
    const seasonalAdjustment = this.calculateSeasonalAdjustment(leadId);
    
    return {
      ...baseScore,
      lifetimeValue: ltv.predicted,
      conversionProbability: conversionPrediction.probability,
      churRisk,
      optimalContactTime: optimalTiming,
      recommendedActions: this.generateRecommendedActions(baseScore, conversionPrediction, competitorAnalysis),
      competitorThreats: competitorAnalysis.mentionedCompetitors,
      seasonalAdjustment
    };
  }

  /**
   * Predict lead lifetime value using automotive industry factors
   */
  private async calculateLifetimeValue(leadId: string): Promise<LeadLifetimeValue> {
    const lead = await storage.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const conversations = await this.getLeadConversations(leadId);
    
    // Base LTV calculation factors for automotive
    const factors = {
      vehicleType: this.assessVehicleTypeValue(lead),
      financialCapacity: this.assessFinancialCapacity(lead, conversations),
      engagementQuality: this.assessEngagementQuality(conversations),
      demographicProfile: this.assessDemographicValue(lead),
      seasonality: this.getSeasonalityFactor()
    };

    // Weighted LTV calculation
    const baseLTV = 
      factors.vehicleType * 0.35 +
      factors.financialCapacity * 0.25 +
      factors.engagementQuality * 0.20 +
      factors.demographicProfile * 0.15 +
      factors.seasonality * 0.05;

    // Automotive industry LTV multipliers
    const automotiveLTVMultiplier = this.getAutomotiveLTVMultiplier(lead);
    const predicted = Math.round(baseLTV * automotiveLTVMultiplier);

    // Timeline breakdown
    const timeline = {
      shortTerm: Math.round(predicted * 0.60), // Initial vehicle purchase
      mediumTerm: Math.round(predicted * 0.25), // Service and maintenance
      longTerm: Math.round(predicted * 0.15)    // Future purchases, referrals
    };

    // Confidence based on data completeness
    const confidence = this.calculateLTVConfidence(lead, conversations, factors);

    return {
      predicted,
      confidence,
      factors,
      timeline
    };
  }

  /**
   * Predict conversion probability using behavioral analysis
   */
  private async predictConversion(leadId: string): Promise<ConversionPrediction> {
    const lead = await storage.getLead(leadId);
    if (!lead) throw new Error('Lead not found');

    const conversations = await this.getLeadConversations(leadId);
    
    // Conversion probability factors
    const urgencyScore = this.analyzeUrgencyIndicators(conversations);
    const engagementScore = this.calculateEngagementScore(conversations);
    const intentScore = this.analyzePurchaseIntent(conversations);
    const behaviorScore = this.analyzeBehaviorPatterns(conversations);
    const demographicScore = this.getDemographicConversionFactor(lead);

    // Weighted conversion probability
    const probability = Math.min(100, Math.round(
      urgencyScore * 0.25 +
      engagementScore * 0.20 +
      intentScore * 0.30 +
      behaviorScore * 0.15 +
      demographicScore * 0.10
    ));

    // Predict timeframe to conversion
    const timeFrame = this.predictConversionTimeframe(urgencyScore, intentScore, engagementScore);
    
    // Identify key factors and blockers
    const keyFactors = this.identifyKeyConversionFactors(lead, conversations);
    const blockers = this.identifyConversionBlockers(conversations);
    const nextBestActions = this.generateNextBestActions(probability, keyFactors, blockers);

    // Confidence based on data quality
    const confidence = this.calculateConversionConfidence(conversations, lead);

    return {
      probability,
      confidence,
      timeFrame,
      keyFactors,
      blockers,
      nextBestActions
    };
  }

  /**
   * Analyze competitor threats and opportunities
   */
  private async analyzeCompetitorThreats(leadId: string): Promise<CompetitorAnalysis> {
    const conversations = await this.getLeadConversations(leadId);
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');

    // Automotive competitor detection
    const competitors = [
      'toyota', 'honda', 'ford', 'chevy', 'chevrolet', 'nissan', 'hyundai', 'kia',
      'bmw', 'mercedes', 'audi', 'lexus', 'acura', 'infiniti', 'cadillac',
      'jeep', 'ram', 'dodge', 'gmc', 'buick', 'volkswagen', 'subaru', 'mazda'
    ];

    const mentionedCompetitors = competitors.filter(comp => 
      allContent.includes(comp) || allContent.includes(`${comp} dealer`)
    );

    // Threat assessment
    let threatLevel: 'low' | 'medium' | 'high' = 'low';
    if (mentionedCompetitors.length >= 3) threatLevel = 'high';
    else if (mentionedCompetitors.length >= 1) threatLevel = 'medium';

    // Price comparison indicators
    const priceComparisonTerms = ['price', 'quote', 'comparison', 'cheaper', 'better deal', 'competitive'];
    const hasPriceComparison = priceComparisonTerms.some(term => allContent.includes(term));
    if (hasPriceComparison && threatLevel === 'low') threatLevel = 'medium';

    // Generate competitive advantages and retention strategies
    const competitiveAdvantages = this.identifyCompetitiveAdvantages(allContent);
    const riskFactors = this.identifyCompetitorRisks(allContent, mentionedCompetitors);
    const retentionStrategies = this.generateRetentionStrategies(threatLevel, mentionedCompetitors, riskFactors);

    return {
      threatLevel,
      mentionedCompetitors,
      competitiveAdvantages,
      riskFactors,
      retentionStrategies
    };
  }

  /**
   * Calculate churn risk based on engagement patterns
   */
  private async calculateChurnRisk(leadId: string): Promise<number> {
    const conversations = await this.getLeadConversations(leadId);
    
    if (conversations.length === 0) return 50; // Medium risk for no engagement
    
    const messages = conversations.flatMap(c => (c as any).messages || []);
    const leadMessages = messages.filter((m: any) => !m.isFromAI);
    
    if (leadMessages.length === 0) return 80; // High risk for no responses
    
    // Time since last interaction
    const lastMessage = leadMessages[leadMessages.length - 1];
    const daysSinceLastContact = Math.floor(
      (Date.now() - new Date(lastMessage.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Response frequency decline
    const responseFrequencyTrend = this.analyzeResponseFrequencyTrend(leadMessages);
    
    // Engagement quality decline
    const engagementQualityTrend = this.analyzeEngagementQualityTrend(leadMessages);
    
    // Calculate churn risk (0-100)
    let churnRisk = 0;
    
    // Days since last contact factor
    if (daysSinceLastContact > 14) churnRisk += 30;
    else if (daysSinceLastContact > 7) churnRisk += 15;
    else if (daysSinceLastContact > 3) churnRisk += 5;
    
    // Response frequency factor
    if (responseFrequencyTrend < -0.5) churnRisk += 25;
    else if (responseFrequencyTrend < -0.2) churnRisk += 10;
    
    // Engagement quality factor
    if (engagementQualityTrend < -0.3) churnRisk += 20;
    else if (engagementQualityTrend < -0.1) churnRisk += 10;
    
    // Negative sentiment indicators
    const negativeTerms = ['not interested', 'stop', 'remove', 'unsubscribe', 'busy', 'later'];
    const hasNegativeSentiment = conversations.some(c => 
      (c as any).messages?.some((m: any) => 
        !m.isFromAI && negativeTerms.some(term => m.content.toLowerCase().includes(term))
      )
    );
    
    if (hasNegativeSentiment) churnRisk += 25;
    
    return Math.min(100, Math.max(0, churnRisk));
  }

  /**
   * Determine optimal contact time based on response patterns
   */
  private async determineOptimalContactTime(leadId: string): Promise<Date | null> {
    const conversations = await this.getLeadConversations(leadId);
    const messages = conversations.flatMap(c => (c as any).messages || []);
    const leadMessages = messages.filter((m: any) => !m.isFromAI);
    
    if (leadMessages.length < 3) return null; // Need sufficient data
    
    // Analyze response time patterns
    const responseTimesByHour = new Map<number, number[]>();
    const responseTimesByDay = new Map<number, number[]>();
    
    for (const message of leadMessages) {
      const messageTime = new Date(message.createdAt);
      const hour = messageTime.getHours();
      const day = messageTime.getDay();
      
      if (!responseTimesByHour.has(hour)) responseTimesByHour.set(hour, []);
      if (!responseTimesByDay.has(day)) responseTimesByDay.set(day, [], []);
      
      responseTimesByHour.get(hour)!.push(1);
      responseTimesByDay.get(day)!.push(1);
    }
    
    // Find optimal hour and day
    let bestHour = 10; // Default business hours
    let bestDay = 2;   // Default Tuesday
    let maxResponses = 0;
    
    for (const [hour, responses] of responseTimesByHour) {
      if (responses.length > maxResponses) {
        maxResponses = responses.length;
        bestHour = hour;
      }
    }
    
    maxResponses = 0;
    for (const [day, responses] of responseTimesByDay) {
      if (responses.length > maxResponses) {
        maxResponses = responses.length;
        bestDay = day;
      }
    }
    
    // Calculate next optimal contact time
    const now = new Date();
    const nextOptimal = new Date(now);
    
    // Set to optimal day of week
    const daysUntilOptimal = (bestDay + 7 - now.getDay()) % 7 || 7;
    nextOptimal.setDate(now.getDate() + daysUntilOptimal);
    nextOptimal.setHours(bestHour, 0, 0, 0);
    
    return nextOptimal;
  }

  /**
   * Calculate seasonal adjustment factor for automotive sales
   */
  private calculateSeasonalAdjustment(leadId: string): number {
    const month = new Date().getMonth();
    
    // Automotive seasonal patterns
    const seasonalFactors = {
      0: 0.8,   // January - post-holiday slowdown
      1: 0.9,   // February - tax season prep
      2: 1.1,   // March - spring buying, tax refunds
      3: 1.2,   // April - spring peak
      4: 1.0,   // May - steady
      5: 0.9,   // June - summer slowdown
      6: 0.8,   // July - summer vacation
      7: 0.9,   // August - back to school prep
      8: 1.1,   // September - fall buying
      9: 1.0,   // October - steady
      10: 1.3,  // November - Black Friday, year-end sales
      11: 1.2   // December - year-end deals, holiday bonuses
    };
    
    return seasonalFactors[month] || 1.0;
  }

  // Helper methods for LTV calculation
  private assessVehicleTypeValue(lead: Lead): number {
    const vehicleInterest = (lead.vehicleInterest || '').toLowerCase();
    
    // Automotive LTV by vehicle type
    if (vehicleInterest.includes('luxury') || vehicleInterest.includes('premium')) return 8000;
    if (vehicleInterest.includes('truck') || vehicleInterest.includes('suv')) return 6000;
    if (vehicleInterest.includes('electric') || vehicleInterest.includes('hybrid')) return 5500;
    if (vehicleInterest.includes('sedan')) return 4000;
    if (vehicleInterest.includes('compact') || vehicleInterest.includes('economy')) return 3000;
    
    return 4500; // Default
  }

  private assessFinancialCapacity(lead: Lead, conversations: Conversation[]): number {
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    let capacity = 3000; // Base
    
    // Positive financial indicators
    if (allContent.includes('cash')) capacity += 2000;
    if (allContent.includes('finance') || allContent.includes('loan')) capacity += 1000;
    if (allContent.includes('trade')) capacity += 800;
    if (allContent.includes('budget')) capacity += 500;
    
    // Negative indicators
    if (allContent.includes('tight budget') || allContent.includes('cheap')) capacity -= 1000;
    if (allContent.includes('payment') && allContent.includes('low')) capacity -= 500;
    
    return Math.max(1000, capacity);
  }

  private assessEngagementQuality(conversations: Conversation[]): number {
    const messages = conversations.flatMap(c => (c as any).messages || []);
    const leadMessages = messages.filter((m: any) => !m.isFromAI);
    
    if (leadMessages.length === 0) return 0;
    
    let quality = 1000; // Base
    
    // Message length and detail
    const avgLength = leadMessages.reduce((acc: number, m: any) => acc + m.content.length, 0) / leadMessages.length;
    if (avgLength > 100) quality += 1000;
    else if (avgLength > 50) quality += 500;
    
    // Questions and specific inquiries
    const questions = leadMessages.filter((m: any) => m.content.includes('?')).length;
    quality += questions * 200;
    
    // Specific automotive terms
    const automotiveTerms = ['mpg', 'warranty', 'features', 'trim', 'options', 'test drive'];
    const automotiveReferences = leadMessages.reduce((count: number, m: any) => {
      return count + automotiveTerms.reduce((termCount, term) => {
        return termCount + (m.content.toLowerCase().includes(term) ? 1 : 0);
      }, 0);
    }, 0);
    
    quality += automotiveReferences * 150;
    
    return quality;
  }

  private assessDemographicValue(lead: Lead): number {
    let value = 2000; // Base
    
    // Complete contact information adds value
    if (lead.firstName && lead.lastName) value += 500;
    if (lead.phone) value += 300;
    
    return value;
  }

  private getSeasonalityFactor(): number {
    return this.calculateSeasonalAdjustment('');
  }

  private getAutomotiveLTVMultiplier(lead: Lead): number {
    const vehicleInterest = (lead.vehicleInterest || '').toLowerCase();
    
    // Premium brands have higher service LTV
    if (vehicleInterest.includes('luxury') || vehicleInterest.includes('bmw') || 
        vehicleInterest.includes('mercedes') || vehicleInterest.includes('audi')) {
      return 1.5;
    }
    
    // Trucks and SUVs have higher parts/service revenue
    if (vehicleInterest.includes('truck') || vehicleInterest.includes('suv')) {
      return 1.3;
    }
    
    // Electric vehicles have lower service revenue but higher loyalty
    if (vehicleInterest.includes('electric') || vehicleInterest.includes('hybrid')) {
      return 1.2;
    }
    
    return 1.0;
  }

  private calculateLTVConfidence(lead: Lead, conversations: Conversation[], factors: any): number {
    let confidence = 50; // Base confidence
    
    // Data completeness
    if (lead.firstName && lead.lastName && lead.phone) confidence += 20;
    if (lead.vehicleInterest) confidence += 15;
    if (conversations.length > 3) confidence += 10;
    
    // Interaction quality
    const messages = conversations.flatMap(c => (c as any).messages || []);
    if (messages.length > 5) confidence += 5;
    
    return Math.min(95, confidence);
  }

  // Helper methods for conversion prediction
  private analyzeUrgencyIndicators(conversations: Conversation[]): number {
    const urgencyTerms = [
      'urgent', 'asap', 'soon', 'quickly', 'immediately', 'this week', 
      'today', 'tomorrow', 'weekend', 'need now', 'ready to buy'
    ];
    
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    let urgencyScore = 0;
    urgencyTerms.forEach(term => {
      if (allContent.includes(term)) urgencyScore += 15;
    });
    
    return Math.min(100, urgencyScore);
  }

  private calculateEngagementScore(conversations: Conversation[]): number {
    const messages = conversations.flatMap(c => (c as any).messages || []);
    const leadMessages = messages.filter((m: any) => !m.isFromAI);
    
    if (leadMessages.length === 0) return 0;
    
    // Response frequency
    let score = Math.min(40, leadMessages.length * 5);
    
    // Response timeliness (if we can calculate it)
    // Average message length
    const avgLength = leadMessages.reduce((acc: number, m: any) => acc + m.content.length, 0) / leadMessages.length;
    if (avgLength > 50) score += 20;
    
    // Questions asked
    const questions = leadMessages.filter((m: any) => m.content.includes('?')).length;
    score += Math.min(20, questions * 5);
    
    return Math.min(100, score);
  }

  private analyzePurchaseIntent(conversations: Conversation[]): number {
    const intentTerms = [
      'buy', 'purchase', 'looking for', 'interested in', 'want to', 'need a',
      'financing', 'loan', 'payment', 'trade in', 'test drive', 'appointment',
      'visit', 'come in', 'see the', 'price', 'cost', 'deal'
    ];
    
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    let intentScore = 0;
    intentTerms.forEach(term => {
      if (allContent.includes(term)) intentScore += 8;
    });
    
    return Math.min(100, intentScore);
  }

  private analyzeBehaviorPatterns(conversations: Conversation[]): number {
    // Analyze positive behavioral indicators
    let behaviorScore = 50; // Neutral baseline
    
    // Multiple conversation threads indicate serious interest
    if (conversations.length > 2) behaviorScore += 20;
    
    // Consistent engagement over time
    const daySpan = this.calculateConversationSpan(conversations);
    if (daySpan > 3) behaviorScore += 15;
    
    return Math.min(100, Math.max(0, behaviorScore));
  }

  private getDemographicConversionFactor(lead: Lead): number {
    let factor = 50; // Baseline
    
    // Complete contact information indicates serious intent
    if (lead.phone && lead.email) factor += 20;
    if (lead.firstName && lead.lastName) factor += 15;
    if (lead.vehicleInterest) factor += 15;
    
    return Math.min(100, factor);
  }

  private predictConversionTimeframe(urgencyScore: number, intentScore: number, engagementScore: number): number {
    const avgScore = (urgencyScore + intentScore + engagementScore) / 3;
    
    if (avgScore > 80) return 7;   // 1 week
    if (avgScore > 60) return 14;  // 2 weeks
    if (avgScore > 40) return 30;  // 1 month
    if (avgScore > 20) return 60;  // 2 months
    
    return 90; // 3+ months
  }

  private identifyKeyConversionFactors(lead: Lead, conversations: Conversation[]): string[] {
    const factors: string[] = [];
    
    if (lead.vehicleInterest) factors.push('Specific vehicle interest');
    if (lead.phone) factors.push('Phone contact provided');
    
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    if (allContent.includes('financing')) factors.push('Financing discussion');
    if (allContent.includes('trade')) factors.push('Trade-in consideration');
    if (allContent.includes('test drive')) factors.push('Test drive interest');
    if (allContent.includes('appointment')) factors.push('Appointment readiness');
    
    return factors;
  }

  private identifyConversionBlockers(conversations: Conversation[]): string[] {
    const blockers: string[] = [];
    
    const allContent = conversations.flatMap(c => (c as any).messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    if (allContent.includes('think about') || allContent.includes('consider')) {
      blockers.push('Still considering options');
    }
    if (allContent.includes('spouse') || allContent.includes('partner')) {
      blockers.push('Needs partner approval');
    }
    if (allContent.includes('budget') && allContent.includes('tight')) {
      blockers.push('Budget constraints');
    }
    if (allContent.includes('next month') || allContent.includes('later')) {
      blockers.push('Timing not immediate');
    }
    
    return blockers;
  }

  private generateNextBestActions(probability: number, keyFactors: string[], blockers: string[]): string[] {
    const actions: string[] = [];
    
    if (probability > 80) {
      actions.push('Schedule immediate appointment');
      actions.push('Prepare purchase documentation');
    } else if (probability > 60) {
      actions.push('Follow up within 24 hours');
      actions.push('Send vehicle information packet');
    } else if (probability > 40) {
      actions.push('Nurture with educational content');
      actions.push('Schedule follow-up in 3-5 days');
    } else {
      actions.push('Add to long-term nurture campaign');
      actions.push('Send monthly market updates');
    }
    
    // Address specific blockers
    if (blockers.includes('Needs partner approval')) {
      actions.push('Invite partner to conversation');
    }
    if (blockers.includes('Budget constraints')) {
      actions.push('Present financing options');
    }
    
    return actions;
  }

  private calculateConversionConfidence(conversations: Conversation[], lead: Lead): number {
    let confidence = 50;
    
    if (conversations.length > 3) confidence += 20;
    if (lead.phone && lead.email) confidence += 15;
    
    const messages = conversations.flatMap(c => (c as any).messages || []);
    if (messages.length > 10) confidence += 10;
    
    return Math.min(95, confidence);
  }

  // Helper methods for competitor analysis
  private identifyCompetitiveAdvantages(content: string): string[] {
    const advantages: string[] = [];
    
    // Look for areas where we can compete
    if (content.includes('price') || content.includes('cost')) {
      advantages.push('Competitive pricing options available');
    }
    if (content.includes('service') || content.includes('maintenance')) {
      advantages.push('Superior service department');
    }
    if (content.includes('warranty') || content.includes('reliability')) {
      advantages.push('Extended warranty programs');
    }
    if (content.includes('financing') || content.includes('payment')) {
      advantages.push('Flexible financing solutions');
    }
    
    return advantages;
  }

  private identifyCompetitorRisks(content: string, competitors: string[]): string[] {
    const risks: string[] = [];
    
    if (competitors.length > 2) {
      risks.push('Shopping multiple dealerships');
    }
    if (content.includes('better deal') || content.includes('cheaper')) {
      risks.push('Price-focused decision making');
    }
    if (content.includes('quote') || content.includes('comparison')) {
      risks.push('Actively comparing offers');
    }
    
    return risks;
  }

  private generateRetentionStrategies(threatLevel: string, competitors: string[], riskFactors: string[]): string[] {
    const strategies: string[] = [];
    
    if (threatLevel === 'high') {
      strategies.push('Immediate manager escalation');
      strategies.push('Competitive pricing analysis');
      strategies.push('Value proposition reinforcement');
    }
    
    if (competitors.length > 0) {
      strategies.push('Highlight unique selling points');
      strategies.push('Schedule immediate test drive');
    }
    
    if (riskFactors.includes('Price-focused decision making')) {
      strategies.push('Present total cost of ownership');
      strategies.push('Emphasize value over price');
    }
    
    return strategies;
  }

  // Utility methods
  private async getLeadConversations(leadId: string): Promise<Conversation[]> {
    const conversations = await storage.getConversations();
    return conversations.filter(c => c.leadId === leadId);
  }

  private analyzeResponseFrequencyTrend(messages: any[]): number {
    if (messages.length < 3) return 0;
    
    // Simple trend analysis - compare first half vs second half
    const midPoint = Math.floor(messages.length / 2);
    const firstHalf = messages.slice(0, midPoint);
    const secondHalf = messages.slice(midPoint);
    
    // Calculate time spans
    const firstSpan = this.getMessageSpanDays(firstHalf);
    const secondSpan = this.getMessageSpanDays(secondHalf);
    
    if (firstSpan === 0 || secondSpan === 0) return 0;
    
    const firstFreq = firstHalf.length / firstSpan;
    const secondFreq = secondHalf.length / secondSpan;
    
    return (secondFreq - firstFreq) / firstFreq;
  }

  private analyzeEngagementQualityTrend(messages: any[]): number {
    if (messages.length < 3) return 0;
    
    const midPoint = Math.floor(messages.length / 2);
    const firstHalf = messages.slice(0, midPoint);
    const secondHalf = messages.slice(midPoint);
    
    const firstAvgLength = firstHalf.reduce((acc, m) => acc + m.content.length, 0) / firstHalf.length;
    const secondAvgLength = secondHalf.reduce((acc, m) => acc + m.content.length, 0) / secondHalf.length;
    
    return (secondAvgLength - firstAvgLength) / firstAvgLength;
  }

  private getMessageSpanDays(messages: any[]): number {
    if (messages.length < 2) return 1;
    
    const first = new Date(messages[0].createdAt);
    const last = new Date(messages[messages.length - 1].createdAt);
    
    return Math.max(1, Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private calculateConversationSpan(conversations: Conversation[]): number {
    if (conversations.length < 2) return 0;
    
    const sorted = conversations.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    const first = new Date(sorted[0].createdAt);
    const last = new Date(sorted[sorted.length - 1].createdAt);
    
    return Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
  }

  private generateRecommendedActions(
    baseScore: LeadScore, 
    conversionPrediction: ConversionPrediction, 
    competitorAnalysis: CompetitorAnalysis
  ): string[] {
    const actions: string[] = [...conversionPrediction.nextBestActions];
    
    // Add competitor-based actions
    if (competitorAnalysis.threatLevel === 'high') {
      actions.push('Schedule urgent follow-up');
      actions.push('Prepare competitive analysis');
    }
    
    // Add score-based actions
    if (baseScore.totalScore > 80) {
      actions.push('Priority lead - immediate attention');
    }
    
    return [...new Set(actions)]; // Remove duplicates
  }

  /**
   * Bulk calculate predictive scores for all leads
   */
  async bulkCalculatePredictiveScores(profileId?: string): Promise<PredictiveLeadScore[]> {
    const leads = await storage.getLeads();
    const scores: PredictiveLeadScore[] = [];

    for (const lead of leads) {
      try {
        const score = await this.calculatePredictiveLeadScore(lead.id, profileId);
        scores.push(score);
      } catch (error) {
        console.error(`Failed to calculate predictive score for lead ${lead.id}:`, error);
      }
    }

    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }
}

export const advancedLeadScoringService = new AdvancedLeadScoringService();