import { storage } from '../storage';
import type { Conversation, ConversationMessage, Lead } from '@shared/schema';

export interface ConversationAnalysis {
  conversationId: string;
  leadId: string;
  mood: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'excited';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  intent: 'research' | 'comparison' | 'ready_to_buy' | 'price_focused' | 'undecided';
  buyingSignals: string[];
  riskFactors: string[];
  recommendedAction: 'continue' | 'escalate' | 'schedule_call' | 'send_offer' | 'urgent_followup';
  confidence: number;
  nextSteps: string[];
  escalationReason?: string;
}

export interface BuyingSignal {
  signal: string;
  weight: number;
  category: 'urgency' | 'financial' | 'decision' | 'timeline';
  description: string;
}

export interface ConversationPattern {
  patternType: 'high_intent' | 'comparison_shopping' | 'price_objection' | 'ready_to_close';
  indicators: string[];
  recommendedResponse: string;
  escalationTrigger: boolean;
  priority: number;
}

export class DynamicResponseIntelligenceService {
  private buyingSignals: BuyingSignal[] = [
    // Urgency signals
    { signal: 'need by', weight: 8, category: 'urgency', description: 'Specific timeline mentioned' },
    { signal: 'this week', weight: 9, category: 'urgency', description: 'Immediate timeline' },
    { signal: 'asap', weight: 9, category: 'urgency', description: 'Urgent request' },
    { signal: 'coming in today', weight: 10, category: 'urgency', description: 'Immediate visit planned' },
    
    // Financial signals
    { signal: 'pre-approved', weight: 9, category: 'financial', description: 'Financing already secured' },
    { signal: 'cash buyer', weight: 10, category: 'financial', description: 'Cash purchase ready' },
    { signal: 'monthly payment', weight: 7, category: 'financial', description: 'Payment discussion' },
    { signal: 'down payment', weight: 8, category: 'financial', description: 'Ready to put money down' },
    { signal: 'trade value', weight: 7, category: 'financial', description: 'Trade-in ready' },
    
    // Decision signals
    { signal: 'ready to buy', weight: 10, category: 'decision', description: 'Explicit buying intent' },
    { signal: 'make a deal', weight: 9, category: 'decision', description: 'Negotiation ready' },
    { signal: 'best price', weight: 8, category: 'decision', description: 'Price negotiation' },
    { signal: 'sign today', weight: 10, category: 'decision', description: 'Ready to close' },
    
    // Timeline signals
    { signal: 'lease expires', weight: 8, category: 'timeline', description: 'Current lease ending' },
    { signal: 'car died', weight: 9, category: 'timeline', description: 'Immediate need' },
    { signal: 'before', weight: 6, category: 'timeline', description: 'Specific deadline' }
  ];

  private conversationPatterns: ConversationPattern[] = [
    {
      patternType: 'high_intent',
      indicators: ['ready to buy', 'cash buyer', 'pre-approved', 'coming in today'],
      recommendedResponse: 'Immediate personal attention with finance manager',
      escalationTrigger: true,
      priority: 10
    },
    {
      patternType: 'comparison_shopping',
      indicators: ['other dealers', 'shopping around', 'better deal', 'competitor'],
      recommendedResponse: 'Focus on unique value propositions and exclusive offers',
      escalationTrigger: false,
      priority: 7
    },
    {
      patternType: 'price_objection',
      indicators: ['too expensive', 'over budget', 'cheaper elsewhere', 'price too high'],
      recommendedResponse: 'Present financing options and total value package',
      escalationTrigger: false,
      priority: 6
    },
    {
      patternType: 'ready_to_close',
      indicators: ['sign today', 'make a deal', 'best price', 'final offer'],
      recommendedResponse: 'Connect with sales manager for closing authority',
      escalationTrigger: true,
      priority: 9
    }
  ];

  async analyzeConversation(conversationId: string): Promise<ConversationAnalysis> {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messages = await storage.getConversationMessages(conversationId);
    const leadMessages = messages.filter(m => !m.isFromAI);
    
    if (leadMessages.length === 0) {
      return this.createDefaultAnalysis(conversationId, conversation.leadId!);
    }

    const analysis = await this.performDeepAnalysis(conversation, leadMessages);
    return analysis;
  }

  async analyzeAllActiveConversations(): Promise<ConversationAnalysis[]> {
    const conversations = await storage.getConversations();
    const activeConversations = conversations.filter(c => c.status === 'active');
    
    const analyses: ConversationAnalysis[] = [];
    
    for (const conversation of activeConversations) {
      try {
        const analysis = await this.analyzeConversation(conversation.id);
        analyses.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze conversation ${conversation.id}:`, error);
      }
    }
    
    return analyses.sort((a, b) => {
      // Sort by urgency and buying signals
      const scoreA = this.calculatePriorityScore(a);
      const scoreB = this.calculatePriorityScore(b);
      return scoreB - scoreA;
    });
  }

  async getEscalationCandidates(): Promise<ConversationAnalysis[]> {
    const analyses = await this.analyzeAllActiveConversations();
    return analyses.filter(a => 
      a.recommendedAction === 'escalate' || 
      a.recommendedAction === 'urgent_followup' ||
      a.urgency === 'critical'
    );
  }

  private async performDeepAnalysis(conversation: Conversation, leadMessages: ConversationMessage[]): Promise<ConversationAnalysis> {
    const allContent = (leadMessages || [])
      .map(m => (m && typeof (m as any).content === 'string' ? (m as any).content : ''))
      .join(' ')
      .toLowerCase();

    // Analyze mood
    const mood = this.analyzeMood(allContent);
    
    // Analyze urgency
    const urgency = this.analyzeUrgency(allContent);
    
    // Analyze intent
    const intent = this.analyzeIntent(allContent);
    
    // Detect buying signals
    const buyingSignals = this.detectBuyingSignals(allContent);
    
    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(allContent);
    
    // Determine recommended action
    const { recommendedAction, escalationReason, nextSteps } = this.determineRecommendedAction(
      mood, urgency, intent, buyingSignals, riskFactors
    );
    
    // Calculate confidence
    const confidence = this.calculateConfidence(leadMessages.length, buyingSignals.length);

    return {
      conversationId: conversation.id,
      leadId: conversation.leadId,
      mood,
      urgency,
      intent,
      buyingSignals,
      riskFactors,
      recommendedAction,
      confidence,
      nextSteps,
      escalationReason
    };
  }

  private analyzeMood(content: string): ConversationAnalysis['mood'] {
    const positiveWords = ['great', 'excellent', 'perfect', 'love', 'excited', 'interested', 'wonderful'];
    const negativeWords = ['terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointed'];
    const frustratedWords = ['frustrated', 'annoyed', 'upset', 'confused', 'difficult'];
    const excitedWords = ['excited', 'thrilled', 'can\'t wait', 'amazing', 'fantastic'];
    
    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;
    const frustratedCount = frustratedWords.filter(word => content.includes(word)).length;
    const excitedCount = excitedWords.filter(word => content.includes(word)).length;
    
    if (excitedCount > 0 || (positiveCount > 2 && negativeCount === 0)) return 'excited';
    if (frustratedCount > 0 || negativeCount > positiveCount) return 'frustrated';
    if (negativeCount > 0) return 'negative';
    if (positiveCount > 0) return 'positive';
    return 'neutral';
  }

  private analyzeUrgency(content: string): ConversationAnalysis['urgency'] {
    const urgencyTerms = {
      critical: ['emergency', 'immediately', 'asap', 'urgent', 'today only', 'right now'],
      high: ['this week', 'soon', 'quickly', 'need by', 'deadline'],
      medium: ['next week', 'by month end', 'sometime soon'],
      low: ['eventually', 'no rush', 'when convenient', 'looking ahead']
    };
    
    for (const [level, terms] of Object.entries(urgencyTerms)) {
      if (terms.some(term => content.includes(term))) {
        return level as ConversationAnalysis['urgency'];
      }
    }
    
    return 'medium';
  }

  private analyzeIntent(content: string): ConversationAnalysis['intent'] {
    const intentPatterns = {
      ready_to_buy: ['ready to buy', 'want to purchase', 'make a deal', 'sign today'],
      price_focused: ['best price', 'cheapest', 'discount', 'deal', 'lower price'],
      comparison: ['comparing', 'other dealers', 'shopping around', 'versus'],
      research: ['learning about', 'information', 'tell me about', 'curious'],
      undecided: ['not sure', 'thinking about', 'maybe', 'considering']
    };
    
    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      if (patterns.some(pattern => content.includes(pattern))) {
        return intent as ConversationAnalysis['intent'];
      }
    }
    
    return 'research';
  }

  private detectBuyingSignals(content: string): string[] {
    const detectedSignals: string[] = [];
    
    for (const signal of this.buyingSignals) {
      if (content.includes(signal.signal)) {
        detectedSignals.push(signal.signal);
      }
    }
    
    return detectedSignals;
  }

  private identifyRiskFactors(content: string): string[] {
    const riskTerms = [
      'other dealers', 'better price elsewhere', 'not interested', 'too expensive',
      'thinking about it', 'call back later', 'not ready', 'just looking'
    ];
    
    return riskTerms.filter(term => content.includes(term));
  }

  private determineRecommendedAction(
    mood: ConversationAnalysis['mood'],
    urgency: ConversationAnalysis['urgency'],
    intent: ConversationAnalysis['intent'],
    buyingSignals: string[],
    riskFactors: string[]
  ): {
    recommendedAction: ConversationAnalysis['recommendedAction'];
    escalationReason?: string;
    nextSteps: string[];
  } {
    const highValueSignals = ['ready to buy', 'cash buyer', 'pre-approved', 'sign today'];
    const hasHighValueSignal = buyingSignals.some(signal => highValueSignals.includes(signal));
    
    if (hasHighValueSignal || urgency === 'critical') {
      return {
        recommendedAction: 'escalate',
        escalationReason: 'High-value buying signals detected',
        nextSteps: [
          'Immediately connect with sales manager',
          'Prepare financing options',
          'Schedule in-person appointment today'
        ]
      };
    }
    
    if (intent === 'ready_to_buy' || buyingSignals.length >= 3) {
      return {
        recommendedAction: 'urgent_followup',
        nextSteps: [
          'Call within 30 minutes',
          'Prepare vehicle availability information',
          'Have financing pre-approval ready'
        ]
      };
    }
    
    if (urgency === 'high' || (mood === 'excited' && buyingSignals.length > 0)) {
      return {
        recommendedAction: 'schedule_call',
        nextSteps: [
          'Schedule phone consultation within 2 hours',
          'Prepare vehicle comparison materials',
          'Have incentive offers ready'
        ]
      };
    }
    
    if (intent === 'price_focused' || buyingSignals.includes('best price')) {
      return {
        recommendedAction: 'send_offer',
        nextSteps: [
          'Prepare competitive pricing analysis',
          'Create personalized offer with incentives',
          'Schedule follow-up call to discuss'
        ]
      };
    }
    
    return {
      recommendedAction: 'continue',
      nextSteps: [
        'Continue nurturing conversation',
        'Provide requested information',
        'Monitor for buying signals'
      ]
    };
  }

  private calculateConfidence(messageCount: number, signalCount: number): number {
    let confidence = 50; // Base confidence
    
    // More messages = higher confidence
    confidence += Math.min(30, messageCount * 5);
    
    // More buying signals = higher confidence
    confidence += Math.min(20, signalCount * 10);
    
    return Math.min(100, confidence);
  }

  private calculatePriorityScore(analysis: ConversationAnalysis): number {
    let score = 0;
    
    // Urgency scoring
    const urgencyScores = { critical: 40, high: 30, medium: 20, low: 10 };
    score += urgencyScores[analysis.urgency];
    
    // Buying signals scoring
    score += analysis.buyingSignals.length * 10;
    
    // Intent scoring
    const intentScores = { ready_to_buy: 30, price_focused: 20, comparison: 15, research: 10, undecided: 5 };
    score += intentScores[analysis.intent];
    
    // Mood scoring
    const moodScores = { excited: 15, positive: 10, neutral: 5, negative: 0, frustrated: -5 };
    score += moodScores[analysis.mood];
    
    return score;
  }

  private createDefaultAnalysis(conversationId: string, leadId: string): ConversationAnalysis {
    return {
      conversationId,
      leadId,
      mood: 'neutral',
      urgency: 'medium',
      intent: 'research',
      buyingSignals: [],
      riskFactors: [],
      recommendedAction: 'continue',
      confidence: 30,
      nextSteps: ['Continue conversation', 'Gather more information']
    };
  }

  async learnFromSuccessfulConversations(): Promise<void> {
    // This would analyze conversations that led to conversions
    // and update patterns and signals accordingly
    const conversations = await storage.getConversations();
    const successfulConversations = conversations.filter(c => c.status === 'converted');
    
    // Machine learning would go here to improve signal detection
    console.log(`Learning from ${successfulConversations.length} successful conversations`);
  }
}

export const dynamicResponseIntelligenceService = new DynamicResponseIntelligenceService();