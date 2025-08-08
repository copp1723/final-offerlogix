import { storage } from '../storage';
import type { Lead, Conversation } from '@shared/schema';

export interface ScoringCriteria {
  id: string;
  name: string;
  description: string;
  weight: number; // 1-10 scale
  category: 'engagement' | 'timing' | 'content' | 'behavior' | 'profile';
}

export interface ScoringProfile {
  id: string;
  name: string;
  description: string;
  industry: string;
  criteria: ScoringCriteria[];
  thresholds: {
    hot: number;    // 80-100
    warm: number;   // 60-79
    cold: number;   // 0-59
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadScore {
  leadId: string;
  totalScore: number;
  priority: 'hot' | 'warm' | 'cold';
  breakdown: Record<string, number>;
  lastCalculated: Date;
  factors: string[];
}

export class LeadScoringService {
  private defaultAutomotiveProfile: ScoringProfile = {
    id: 'automotive-default',
    name: 'Automotive Sales Priority',
    description: 'Standard automotive dealership lead scoring focused on purchase intent and urgency',
    industry: 'automotive',
    criteria: [
      {
        id: 'response_speed',
        name: 'Response Speed',
        description: 'How quickly lead responds to initial contact',
        weight: 8,
        category: 'engagement'
      },
      {
        id: 'message_quality',
        name: 'Message Quality',
        description: 'Specificity and detail in lead communications',
        weight: 7,
        category: 'content'
      },
      {
        id: 'vehicle_specificity',
        name: 'Vehicle Interest Specificity',
        description: 'How specific the lead is about vehicle models/features',
        weight: 9,
        category: 'content'
      },
      {
        id: 'urgency_indicators',
        name: 'Urgency Language',
        description: 'Use of urgent language like "need soon", "this week", "ASAP"',
        weight: 8,
        category: 'content'
      },
      {
        id: 'financial_readiness',
        name: 'Financial Indicators',
        description: 'Mentions of financing, budget, trade-in, cash purchase',
        weight: 7,
        category: 'behavior'
      },
      {
        id: 'engagement_frequency',
        name: 'Engagement Frequency',
        description: 'Number of interactions and follow-ups initiated by lead',
        weight: 6,
        category: 'engagement'
      },
      {
        id: 'contact_completeness',
        name: 'Contact Information',
        description: 'Completeness of contact details provided',
        weight: 5,
        category: 'profile'
      },
      {
        id: 'timing_patterns',
        name: 'Response Timing',
        description: 'Responds during business hours vs off-hours',
        weight: 4,
        category: 'timing'
      }
    ],
    thresholds: {
      hot: 80,
      warm: 60,
      cold: 0
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  async calculateLeadScore(leadId: string, profileId?: string): Promise<LeadScore> {
    const lead = await storage.getLead(leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    const profile = profileId ? 
      await this.getScoringProfile(profileId) : 
      this.defaultAutomotiveProfile;

    const conversations = await storage.getConversationsByLead(leadId);
    const score = await this.computeScore(lead, conversations, profile);
    
    return score;
  }

  private async computeScore(lead: Lead, conversations: Conversation[], profile: ScoringProfile): Promise<LeadScore> {
    const breakdown: Record<string, number> = {};
    const factors: string[] = [];
    let totalScore = 0;

    for (const criteria of profile.criteria) {
      const score = await this.evaluateCriteria(criteria, lead, conversations);
      const weightedScore = (score / 100) * criteria.weight * 10; // Scale to 0-100
      breakdown[criteria.id] = weightedScore;
      totalScore += weightedScore;

      if (score > 70) {
        factors.push(`Strong ${criteria.name.toLowerCase()}`);
      }
    }

    // Normalize to 0-100 scale
    const maxPossibleScore = profile.criteria.reduce((sum, c) => sum + (c.weight * 10), 0);
    totalScore = (totalScore / maxPossibleScore) * 100;

    const priority = this.determinePriority(totalScore, profile.thresholds);

    return {
      leadId: lead.id,
      totalScore: Math.round(totalScore),
      priority,
      breakdown,
      lastCalculated: new Date(),
      factors
    };
  }

  private async evaluateCriteria(criteria: ScoringCriteria, lead: Lead, conversations: Conversation[]): Promise<number> {
    switch (criteria.id) {
      case 'response_speed':
        return this.evaluateResponseSpeed(conversations);
      case 'message_quality':
        return this.evaluateMessageQuality(conversations);
      case 'vehicle_specificity':
        return this.evaluateVehicleSpecificity(lead, conversations);
      case 'urgency_indicators':
        return this.evaluateUrgencyIndicators(conversations);
      case 'financial_readiness':
        return this.evaluateFinancialReadiness(conversations);
      case 'engagement_frequency':
        return this.evaluateEngagementFrequency(conversations);
      case 'contact_completeness':
        return this.evaluateContactCompleteness(lead);
      case 'timing_patterns':
        return this.evaluateTimingPatterns(conversations);
      default:
        return 50; // Default neutral score
    }
  }

  private evaluateResponseSpeed(conversations: Conversation[]): number {
    if (conversations.length === 0) return 0;
    
    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (let i = 1; i < conversations.length; i++) {
      const prevTime = new Date(conversations[i-1].createdAt).getTime();
      const currTime = new Date(conversations[i].createdAt).getTime();
      const responseTime = currTime - prevTime;
      
      if (responseTime < 24 * 60 * 60 * 1000) { // Within 24 hours
        totalResponseTime += responseTime;
        responseCount++;
      }
    }
    
    if (responseCount === 0) return 30;
    
    const avgResponseHours = (totalResponseTime / responseCount) / (1000 * 60 * 60);
    
    if (avgResponseHours < 1) return 100;
    if (avgResponseHours < 4) return 85;
    if (avgResponseHours < 12) return 70;
    if (avgResponseHours < 24) return 50;
    return 25;
  }

  private evaluateMessageQuality(conversations: Conversation[]): Promise<number> {
    // Analyze message content for quality indicators
    const messages = conversations.flatMap(c => c.messages || []);
    const leadMessages = messages.filter(m => !m.isFromAI);
    
    if (leadMessages.length === 0) return Promise.resolve(0);
    
    let qualityScore = 0;
    let totalMessages = leadMessages.length;
    
    for (const message of leadMessages) {
      const content = message.content.toLowerCase();
      let messageScore = 30; // Base score
      
      // Length and detail
      if (content.length > 100) messageScore += 20;
      if (content.length > 300) messageScore += 20;
      
      // Specific questions
      if (content.includes('?')) messageScore += 15;
      
      // Personal details
      if (content.match(/\b(my|i|me|we)\b/g)?.length > 2) messageScore += 15;
      
      qualityScore += Math.min(100, messageScore);
    }
    
    return Promise.resolve(qualityScore / totalMessages);
  }

  private evaluateVehicleSpecificity(lead: Lead, conversations: Conversation[]): number {
    let specificityScore = 0;
    
    // Check lead vehicle interest
    if (lead.vehicleInterest) {
      if (lead.vehicleInterest.match(/\b(model|trim|color|year)\b/i)) specificityScore += 40;
      if (lead.vehicleInterest.length > 20) specificityScore += 20;
    }
    
    // Check conversation content
    const allContent = conversations.flatMap(c => c.messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    const specificTerms = ['model', 'trim', 'color', 'year', 'features', 'options', 'package'];
    const mentionedTerms = specificTerms.filter(term => allContent.includes(term));
    specificityScore += mentionedTerms.length * 8;
    
    return Math.min(100, specificityScore);
  }

  private evaluateUrgencyIndicators(conversations: Conversation[]): number {
    const urgencyTerms = [
      'asap', 'urgent', 'soon', 'quickly', 'immediately', 'this week', 
      'need now', 'today', 'tomorrow', 'weekend', 'ready to buy'
    ];
    
    const allContent = conversations.flatMap(c => c.messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    let urgencyScore = 0;
    for (const term of urgencyTerms) {
      if (allContent.includes(term)) {
        urgencyScore += 15;
      }
    }
    
    return Math.min(100, urgencyScore);
  }

  private evaluateFinancialReadiness(conversations: Conversation[]): number {
    const financialTerms = [
      'financing', 'loan', 'payment', 'budget', 'cash', 'trade-in', 
      'down payment', 'monthly', 'lease', 'credit', 'approved'
    ];
    
    const allContent = conversations.flatMap(c => c.messages || [])
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    let financialScore = 0;
    for (const term of financialTerms) {
      if (allContent.includes(term)) {
        financialScore += 12;
      }
    }
    
    return Math.min(100, financialScore);
  }

  private evaluateEngagementFrequency(conversations: Conversation[]): number {
    const totalInteractions = conversations.length;
    const leadInitiatedConversations = conversations.filter(c => 
      c.messages && c.messages[0] && !c.messages[0].isFromAI
    ).length;
    
    let engagementScore = Math.min(50, totalInteractions * 10);
    engagementScore += Math.min(50, leadInitiatedConversations * 15);
    
    return Math.min(100, engagementScore);
  }

  private evaluateContactCompleteness(lead: Lead): number {
    let completenessScore = 0;
    
    if (lead.email) completenessScore += 30;
    if (lead.phone) completenessScore += 25;
    if (lead.firstName) completenessScore += 20;
    if (lead.lastName) completenessScore += 15;
    if (lead.vehicleInterest) completenessScore += 10;
    
    return Math.min(100, completenessScore);
  }

  private evaluateTimingPatterns(conversations: Conversation[]): number {
    const businessHours = conversations.filter(c => {
      const hour = new Date(c.createdAt).getHours();
      return hour >= 9 && hour <= 17;
    }).length;
    
    const totalConversations = conversations.length;
    if (totalConversations === 0) return 50;
    
    const businessHourRatio = businessHours / totalConversations;
    return Math.round(businessHourRatio * 100);
  }

  private determinePriority(score: number, thresholds: ScoringProfile['thresholds']): 'hot' | 'warm' | 'cold' {
    if (score >= thresholds.hot) return 'hot';
    if (score >= thresholds.warm) return 'warm';
    return 'cold';
  }

  private async getScoringProfile(profileId: string): Promise<ScoringProfile> {
    // For now return default, but this would query a profiles table
    return this.defaultAutomotiveProfile;
  }

  async createScoringProfile(profile: Omit<ScoringProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScoringProfile> {
    const newProfile: ScoringProfile = {
      ...profile,
      id: `profile-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // This would save to database in real implementation
    return newProfile;
  }

  async bulkScoreLeads(profileId?: string): Promise<LeadScore[]> {
    const leads = await storage.getLeads();
    const scores: LeadScore[] = [];
    
    for (const lead of leads) {
      try {
        const score = await this.calculateLeadScore(lead.id, profileId);
        scores.push(score);
      } catch (error) {
        console.error(`Failed to score lead ${lead.id}:`, error);
      }
    }
    
    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }
}

export const leadScoringService = new LeadScoringService();