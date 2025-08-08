import { storage } from '../storage';
import type { Lead, Conversation } from '@shared/schema';
import { searchMemories, extractMemoryContent } from './supermemory';

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

  private subPrimeAutomotiveProfile: ScoringProfile = {
    id: 'subprime-automotive',
    name: 'Sub-Prime Automotive',
    description: 'Optimized scoring for sub-prime automotive customers with focus on engagement and urgency',
    industry: 'automotive-subprime',
    criteria: [
      {
        id: 'response_speed',
        name: 'Response Speed',
        description: 'How quickly lead responds to initial contact',
        weight: 10,
        category: 'engagement'
      },
      {
        id: 'urgency_indicators',
        name: 'Urgency Language',
        description: 'Use of urgent language like "need soon", "this week", "ASAP"',
        weight: 9,
        category: 'content'
      },
      {
        id: 'engagement_frequency',
        name: 'Engagement Frequency',
        description: 'Number of interactions and follow-ups initiated by lead',
        weight: 8,
        category: 'engagement'
      },
      {
        id: 'vehicle_specificity',
        name: 'Vehicle Interest Specificity',
        description: 'How specific the lead is about vehicle models/features',
        weight: 6,
        category: 'content'
      },
      {
        id: 'contact_completeness',
        name: 'Contact Information',
        description: 'Completeness of contact details provided',
        weight: 5,
        category: 'profile'
      },
      {
        id: 'message_quality',
        name: 'Message Quality',
        description: 'Specificity and detail in lead communications',
        weight: 4,
        category: 'content'
      },
      {
        id: 'financial_readiness',
        name: 'Financial Indicators',
        description: 'Mentions of financing, budget, trade-in, cash purchase',
        weight: 3,
        category: 'behavior'
      },
      {
        id: 'timing_patterns',
        name: 'Response Timing',
        description: 'Responds during business hours vs off-hours',
        weight: 2,
        category: 'timing'
      }
    ],
    thresholds: {
      hot: 60,
      warm: 30,
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

    // Fallback if storage.getConversationsByLead is not implemented
    const conversations = (storage as any).getConversationsByLead
      ? await (storage as any).getConversationsByLead(leadId)
      : (await storage.getConversations()).filter((c: Conversation) => c.leadId === leadId);
    const score = await this.computeScore(lead, conversations, profile);
    
    return score;
  }

  private async computeScore(lead: Lead, conversations: Conversation[], profile: ScoringProfile): Promise<LeadScore> {
    const breakdown: Record<string, number> = {};
    const factors: string[] = [];
    let totalScore = 0;

    for (const criteria of profile.criteria) {
      const raw = await this.evaluateCriteria(criteria, lead, conversations);
      const weighted = (raw / 100) * criteria.weight * 10; // Scale to 0-100
      breakdown[criteria.id] = Math.round(weighted);
      totalScore += weighted;

      if (raw > 70) {
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

  // ---- Helpers & improved metrics ----
  private getAllMessages(conversations: Conversation[]) {
    return conversations.flatMap(c => c.messages || []);
  }

  private getLeadMessages(conversations: Conversation[]) {
    return this.getAllMessages(conversations).filter((m: any) => !m.isFromAI);
  }

  private getAgentMessages(conversations: Conversation[]) {
    return this.getAllMessages(conversations).filter((m: any) => m.isFromAI);
  }

  private toLowerBlob(conversations: Conversation[]) {
    return this.getAllMessages(conversations)
      .map((m: any) => (m.content || '').toLowerCase())
      .join(' ');
  }

  // True reply latency: avg time from lead message -> next agent reply
  private evaluateResponseSpeed(conversations: Conversation[]): number {
    const msgs = this.getAllMessages(conversations).slice().sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    if (msgs.length < 2) return 0;

    let totalMs = 0, count = 0;
    for (let i = 0; i < msgs.length; i++) {
      const m: any = msgs[i];
      if (!m.isFromAI) { // lead spoke
        const reply = msgs.slice(i + 1).find((n: any) => n.isFromAI);
        if (reply) {
          totalMs += new Date(reply.createdAt).getTime() - new Date(m.createdAt).getTime();
          count++;
        }
      }
    }
    if (!count) return 30;

    const hrs = (totalMs / count) / 36e5;
    if (hrs < 1) return 100;
    if (hrs < 4) return 85;
    if (hrs < 12) return 70;
    if (hrs < 24) return 50;
    return 25;
  }

  private evaluateMessageQuality(conversations: Conversation[]): Promise<number> {
    // Analyze message content for quality indicators
    const messages = this.getAllMessages(conversations);
    const leadMessages = messages.filter((m: any) => !m.isFromAI);
    
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
    const blob = ((lead.vehicleInterest || '') + ' ' + this.toLowerBlob(conversations)).toLowerCase();
    let score = 0;
    if (/\b(20[12]\d)\b/.test(blob)) score += 20;                               // model year
    if (/\b(lx|ex|se|le|xle|sport|limited|trd|platinum|ltz|sv)\b/.test(blob)) score += 20; // trims
    if (/\b(awd|4wd|rwd|fwd|hybrid|turbo|v6|v8)\b/.test(blob)) score += 15;     // config
    if (/\b(color|black|white|blue|red|silver|gray)\b/.test(blob)) score += 10; // color
    if (/\b(model|trim|features|options|package)\b/.test(blob)) score += 10;    // detail words
    if ((lead.vehicleInterest || '').length > 20) score += 15;                  // descriptive field
    return Math.min(100, score);
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
    const msgs = this.getAllMessages(conversations);
    const leadMsgs = msgs.filter((m: any) => !m.isFromAI).length;
    if (!msgs.length) return 0;
    const threadStartsByLead = (conversations || []).filter(c => {
      const first = (c.messages || [])[0] as any;
      return first && !first.isFromAI;
    }).length;
    let score = 0;
    score += Math.min(60, leadMsgs * 8);            // lead message volume
    score += Math.min(40, threadStartsByLead * 20); // initiative
    return Math.min(100, score);
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
    const leadMsgs = this.getLeadMessages(conversations);
    if (!leadMsgs.length) return 50;
    const inBiz = leadMsgs.filter((m: any) => {
      const d = new Date(m.createdAt);
      const h = d.getHours();
      return h >= 9 && h <= 17;
    }).length;
    return Math.round((inBiz / leadMsgs.length) * 100);
  }

  private determinePriority(score: number, thresholds: ScoringProfile['thresholds']): 'hot' | 'warm' | 'cold' {
    if (score >= thresholds.hot) return 'hot';
    if (score >= thresholds.warm) return 'warm';
    return 'cold';
  }

  private async getScoringProfile(profileId: string): Promise<ScoringProfile> {
    // For now return based on profileId, but this would query a profiles table
    switch (profileId) {
      case 'subprime-automotive':
        return this.subPrimeAutomotiveProfile;
      case 'automotive-default':
      default:
        return this.defaultAutomotiveProfile;
    }
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