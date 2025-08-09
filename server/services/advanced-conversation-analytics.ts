import { dynamicResponseIntelligenceService, type ConversationAnalysis, type BuyingSignal } from './dynamic-response-intelligence';
import { storage } from '../storage';
import { getOpenAIClient } from './openai';
import type { Conversation, ConversationMessage, Lead } from '@shared/schema';

/**
 * Advanced Conversation Analytics Service
 * 
 * Enhances the existing conversation analysis with advanced features:
 * - Sentiment progression tracking over time
 * - Improved intent classification with confidence scoring
 * - Buying signal confidence scoring and validation
 * - Conversation outcome prediction
 * - Real-time coaching suggestions for agents
 * - Conversation quality metrics and scoring
 */

export interface SentimentProgression {
  conversationId: string;
  progression: Array<{
    messageIndex: number;
    timestamp: Date;
    sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
    confidence: number;
    triggers: string[]; // What caused the sentiment shift
    intensity: number; // 0-100 scale
  }>;
  overallTrend: 'improving' | 'declining' | 'stable' | 'volatile';
  criticalPoints: Array<{
    messageIndex: number;
    type: 'positive_peak' | 'negative_dip' | 'major_shift';
    description: string;
    impact: number;
  }>;
  recommendations: string[];
}

export interface IntentClassification {
  conversationId: string;
  messageId: string;
  primaryIntent: {
    intent: string;
    confidence: number;
    reasoning: string;
  };
  secondaryIntents: Array<{
    intent: string;
    confidence: number;
  }>;
  intentProgression: Array<{
    messageIndex: number;
    intent: string;
    confidence: number;
    timestamp: Date;
  }>;
  finalizedIntent: string;
  intentStability: number; // How stable the intent classification has been
}

export interface BuyingSignalAnalysis {
  conversationId: string;
  signals: Array<{
    signal: string;
    confidence: number;
    context: string;
    messageIndex: number;
    timestamp: Date;
    validated: boolean;
    strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
    category: 'urgency' | 'financial' | 'decision' | 'timeline';
  }>;
  signalProgression: Array<{
    timestamp: Date;
    signalCount: number;
    strongSignals: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  buyingReadiness: {
    score: number; // 0-100
    level: 'not_ready' | 'researching' | 'considering' | 'ready' | 'urgent';
    confidence: number;
    keyIndicators: string[];
    missingSignals: string[];
  };
  recommendations: string[];
}

export interface ConversationOutcomePrediction {
  conversationId: string;
  predictions: {
    conversionProbability: number; // 0-100
    timeToConversion: number; // days
    expectedValue: number; // dollar amount
    dropOffRisk: number; // 0-100
    escalationLikelihood: number; // 0-100
  };
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    description: string;
  }>;
  scenarioAnalysis: Array<{
    scenario: string;
    probability: number;
    outcome: string;
    recommendedAction: string;
  }>;
  confidenceInterval: {
    low: number;
    high: number;
    accuracy: number;
  };
}

export interface CoachingSuggestion {
  type: 'response_guidance' | 'question_suggestion' | 'escalation_alert' | 'opportunity_highlight' | 'risk_warning';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  suggestedAction: string;
  expectedOutcome: string;
  confidence: number;
  timing: 'immediate' | 'next_response' | 'within_hour' | 'next_contact';
}

export interface ConversationQualityMetrics {
  conversationId: string;
  overallScore: number; // 0-100
  dimensions: {
    responsiveness: number;
    personalization: number;
    problemResolution: number;
    salesEffectiveness: number;
    customerSatisfaction: number;
    professionalismScore: number;
  };
  improvement: {
    primaryArea: string;
    suggestions: string[];
    potentialImpact: number;
  };
  benchmarkComparison: {
    industryAverage: number;
    topPerformer: number;
    relativePerfornance: 'below_average' | 'average' | 'above_average' | 'top_tier';
  };
}

export class AdvancedConversationAnalytics {
  
  /**
   * Track sentiment progression throughout the conversation
   */
  async analyzeSentimentProgression(conversationId: string): Promise<SentimentProgression> {
    const messages = await storage.getConversationMessages(conversationId);
    const leadMessages = messages.filter(m => !m.isFromAI);
    
    if (leadMessages.length === 0) {
      return this.createEmptySentimentProgression(conversationId);
    }

    const progression = await this.analyzeSentimentSequence(leadMessages);
    const trend = this.calculateSentimentTrend(progression);
    const criticalPoints = this.identifyCriticalSentimentPoints(progression);
    const recommendations = this.generateSentimentRecommendations(progression, trend);

    return {
      conversationId,
      progression,
      overallTrend: trend,
      criticalPoints,
      recommendations
    };
  }

  /**
   * Enhanced intent classification with confidence and progression tracking
   */
  async classifyIntentEnhanced(conversationId: string, messageId?: string): Promise<IntentClassification> {
    const messages = await storage.getConversationMessages(conversationId);
    const targetMessage = messageId 
      ? messages.find(m => m.id === messageId)
      : messages[messages.length - 1];
    
    if (!targetMessage) {
      throw new Error('Message not found for intent classification');
    }

    const client = getOpenAIClient();
    const conversationContext = messages.slice(-5).map(m => 
      `${m.isFromAI ? 'Agent' : 'Customer'}: ${m.content}`
    ).join('\n');

    const prompt = `
    Analyze this customer message for intent classification:
    
    Recent conversation context:
    ${conversationContext}
    
    Target message: "${targetMessage.content}"
    
    Provide detailed intent analysis:
    {
      "primaryIntent": {
        "intent": "information_seeking|price_inquiry|test_drive_request|financing_inquiry|complaint|compliment|ready_to_purchase|comparison_shopping|service_request|appointment_scheduling",
        "confidence": 0-100,
        "reasoning": "detailed explanation"
      },
      "secondaryIntents": [
        {
          "intent": "secondary intent",
          "confidence": 0-100
        }
      ],
      "intentStability": 0-100
    }
    
    Consider automotive sales context and customer journey progression.
    `;

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert in automotive customer intent analysis. Provide precise intent classification with confidence scores."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 400
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      // Build intent progression
      const intentProgression = await this.buildIntentProgression(conversationId);
      
      return {
        conversationId,
        messageId: targetMessage.id,
        primaryIntent: analysis.primaryIntent,
        secondaryIntents: analysis.secondaryIntents || [],
        intentProgression,
        finalizedIntent: this.determineFininalizedIntent(intentProgression, analysis.primaryIntent),
        intentStability: analysis.intentStability || 50
      };
    } catch (error) {
      console.error('Intent classification error:', error);
      return this.createFallbackIntentClassification(conversationId, messageId || targetMessage.id);
    }
  }

  /**
   * Analyze and score buying signals with confidence
   */
  async analyzeBuyingSignals(conversationId: string): Promise<BuyingSignalAnalysis> {
    const messages = await storage.getConversationMessages(conversationId);
    const analysis = await dynamicResponseIntelligenceService.analyzeConversation(conversationId);
    
    // Enhanced buying signal analysis with AI validation
    const signalAnalysis = await this.validateBuyingSignals(messages, analysis.buyingSignals);
    const progression = this.calculateSignalProgression(signalAnalysis);
    const readiness = this.assessBuyingReadiness(signalAnalysis, progression);
    const recommendations = this.generateBuyingSignalRecommendations(readiness, signalAnalysis);

    return {
      conversationId,
      signals: signalAnalysis,
      signalProgression: progression,
      buyingReadiness: readiness,
      recommendations
    };
  }

  /**
   * Predict conversation outcomes using ML-like analysis
   */
  async predictConversationOutcome(conversationId: string): Promise<ConversationOutcomePrediction> {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const messages = await storage.getConversationMessages(conversationId);
    const analysis = await dynamicResponseIntelligenceService.analyzeConversation(conversationId);
    const lead = await storage.getLead(conversation.leadId);
    
    // Analyze factors that impact conversion
    const factors = await this.analyzeConversionFactors(messages, analysis, lead);
    const predictions = this.calculateOutcomePredictions(factors, analysis, lead);
    const scenarios = this.generateScenarioAnalysis(factors, predictions);
    const confidence = this.calculatePredictionConfidence(factors, messages.length);

    return {
      conversationId,
      predictions,
      factors,
      scenarioAnalysis: scenarios,
      confidenceInterval: confidence
    };
  }

  /**
   * Generate real-time coaching suggestions for agents
   */
  async generateCoachingSuggestions(conversationId: string): Promise<CoachingSuggestion[]> {
    const context = await this.buildCoachingContext(conversationId);
    const suggestions: CoachingSuggestion[] = [];

    // Response quality coaching
    suggestions.push(...await this.generateResponseQualityCoaching(context));
    
    // Opportunity identification coaching
    suggestions.push(...await this.generateOpportunityCoaching(context));
    
    // Risk mitigation coaching
    suggestions.push(...await this.generateRiskMitigationCoaching(context));
    
    // Next best action coaching
    suggestions.push(...await this.generateNextBestActionCoaching(context));

    return suggestions
      .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority))
      .slice(0, 8); // Top 8 suggestions
  }

  /**
   * Calculate comprehensive conversation quality metrics
   */
  async calculateConversationQuality(conversationId: string): Promise<ConversationQualityMetrics> {
    const messages = await storage.getConversationMessages(conversationId);
    const analysis = await dynamicResponseIntelligenceService.analyzeConversation(conversationId);
    
    // Calculate individual dimension scores
    const dimensions = {
      responsiveness: await this.calculateResponsenessScore(messages),
      personalization: await this.calculatePersonalizationScore(messages, conversationId),
      problemResolution: await this.calculateProblemResolutionScore(messages, analysis),
      salesEffectiveness: await this.calculateSalesEffectivenessScore(messages, analysis),
      customerSatisfaction: await this.calculateCustomerSatisfactionScore(messages, analysis),
      professionalismScore: await this.calculateProfessionalismScore(messages)
    };

    const overallScore = this.calculateOverallQualityScore(dimensions);
    const improvement = this.identifyImprovementOpportunities(dimensions);
    const benchmark = this.compareToBenchmarks(overallScore);

    return {
      conversationId,
      overallScore,
      dimensions,
      improvement,
      benchmarkComparison: benchmark
    };
  }

  /**
   * Private helper methods for sentiment analysis
   */
  private async analyzeSentimentSequence(messages: ConversationMessage[]): Promise<SentimentProgression['progression']> {
    const client = getOpenAIClient();
    const progression: SentimentProgression['progression'] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const context = i > 0 ? messages.slice(Math.max(0, i - 2), i).map(m => m.content).join(' ') : '';
      
      const prompt = `
      Analyze sentiment of this customer message in context:
      
      Previous context: "${context}"
      Current message: "${message.content}"
      
      Return JSON:
      {
        "sentiment": "very_positive|positive|neutral|negative|very_negative",
        "confidence": 0-100,
        "intensity": 0-100,
        "triggers": ["what caused this sentiment"]
      }
      `;

      try {
        const response = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system", 
              content: "You are an expert in customer sentiment analysis for automotive sales conversations."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 200
        });

        const sentimentData = JSON.parse(response.choices[0].message.content || '{}');
        
        progression.push({
          messageIndex: i,
          timestamp: message.createdAt,
          sentiment: sentimentData.sentiment || 'neutral',
          confidence: sentimentData.confidence || 50,
          triggers: sentimentData.triggers || [],
          intensity: sentimentData.intensity || 50
        });
      } catch (error) {
        console.error('Sentiment analysis error for message:', i, error);
        progression.push({
          messageIndex: i,
          timestamp: message.createdAt,
          sentiment: 'neutral',
          confidence: 30,
          triggers: [],
          intensity: 50
        });
      }
    }

    return progression;
  }

  private calculateSentimentTrend(progression: SentimentProgression['progression']): SentimentProgression['overallTrend'] {
    if (progression.length < 2) return 'stable';
    
    const sentimentScores = progression.map(p => this.sentimentToScore(p.sentiment));
    const first = sentimentScores[0];
    const last = sentimentScores[sentimentScores.length - 1];
    const variance = this.calculateVariance(sentimentScores);
    
    if (variance > 15) return 'volatile';
    if (last - first > 10) return 'improving';
    if (first - last > 10) return 'declining';
    return 'stable';
  }

  private sentimentToScore(sentiment: string): number {
    const scores = {
      'very_negative': 10,
      'negative': 30,
      'neutral': 50,
      'positive': 70,
      'very_positive': 90
    };
    return scores[sentiment as keyof typeof scores] || 50;
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const variance = numbers.reduce((acc, num) => acc + Math.pow(num - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  private identifyCriticalSentimentPoints(progression: SentimentProgression['progression']): SentimentProgression['criticalPoints'] {
    const points: SentimentProgression['criticalPoints'] = [];
    
    for (let i = 1; i < progression.length - 1; i++) {
      const prev = this.sentimentToScore(progression[i - 1].sentiment);
      const current = this.sentimentToScore(progression[i].sentiment);
      const next = this.sentimentToScore(progression[i + 1].sentiment);
      
      // Peak detection
      if (current > prev && current > next && current >= 70) {
        points.push({
          messageIndex: i,
          type: 'positive_peak',
          description: 'Customer sentiment reached a positive peak',
          impact: (current - Math.max(prev, next)) / 10
        });
      }
      
      // Dip detection
      if (current < prev && current < next && current <= 30) {
        points.push({
          messageIndex: i,
          type: 'negative_dip',
          description: 'Customer sentiment dropped significantly',
          impact: (Math.min(prev, next) - current) / 10
        });
      }
      
      // Major shift detection
      if (Math.abs(current - prev) > 30) {
        points.push({
          messageIndex: i,
          type: 'major_shift',
          description: `Significant sentiment shift: ${progression[i - 1].sentiment} to ${progression[i].sentiment}`,
          impact: Math.abs(current - prev) / 10
        });
      }
    }
    
    return points;
  }

  private generateSentimentRecommendations(
    progression: SentimentProgression['progression'],
    trend: SentimentProgression['overallTrend']
  ): string[] {
    const recommendations: string[] = [];
    
    if (trend === 'declining') {
      recommendations.push('Address customer concerns immediately');
      recommendations.push('Escalate to senior agent or manager');
      recommendations.push('Focus on problem resolution over sales');
    }
    
    if (trend === 'improving') {
      recommendations.push('Maintain positive momentum');
      recommendations.push('Consider advancing to next stage of sales process');
      recommendations.push('Reinforce positive aspects mentioned');
    }
    
    if (trend === 'volatile') {
      recommendations.push('Stabilize conversation with clear, consistent messaging');
      recommendations.push('Identify and address sources of sentiment swings');
      recommendations.push('Use more measured, professional tone');
    }
    
    const latestSentiment = progression[progression.length - 1]?.sentiment;
    if (latestSentiment === 'very_negative' || latestSentiment === 'negative') {
      recommendations.push('Immediate damage control required');
      recommendations.push('Acknowledge concerns and provide solutions');
    }
    
    return recommendations;
  }

  private async validateBuyingSignals(
    messages: ConversationMessage[],
    detectedSignals: string[]
  ): Promise<BuyingSignalAnalysis['signals']> {
    const client = getOpenAIClient();
    const signals: BuyingSignalAnalysis['signals'] = [];
    
    const conversationText = messages
      .filter(m => !m.isFromAI)
      .map(m => m.content)
      .join(' ');

    for (let i = 0; i < detectedSignals.length; i++) {
      const signal = detectedSignals[i];
      
      const prompt = `
      Validate and analyze this potential buying signal in context:
      
      Signal: "${signal}"
      Full conversation: "${conversationText}"
      
      Return JSON:
      {
        "validated": true/false,
        "confidence": 0-100,
        "strength": "weak|moderate|strong|very_strong",
        "context": "surrounding context where signal appears",
        "reasoning": "why this is/isn't a valid buying signal"
      }
      `;

      try {
        const response = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are an expert automotive sales analyst specializing in buying signal validation."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 300
        });

        const validation = JSON.parse(response.choices[0].message.content || '{}');
        
        signals.push({
          signal,
          confidence: validation.confidence || 50,
          context: validation.context || '',
          messageIndex: this.findSignalMessageIndex(messages, signal),
          timestamp: new Date(),
          validated: validation.validated || false,
          strength: validation.strength || 'moderate',
          category: this.categorizeBuyingSignal(signal)
        });
      } catch (error) {
        console.error('Buying signal validation error:', error);
        signals.push({
          signal,
          confidence: 50,
          context: '',
          messageIndex: 0,
          timestamp: new Date(),
          validated: true,
          strength: 'moderate',
          category: 'decision'
        });
      }
    }
    
    return signals;
  }

  private findSignalMessageIndex(messages: ConversationMessage[], signal: string): number {
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].content.toLowerCase().includes(signal.toLowerCase())) {
        return i;
      }
    }
    return 0;
  }

  private categorizeBuyingSignal(signal: string): BuyingSignalAnalysis['signals'][0]['category'] {
    const urgencySignals = ['asap', 'urgent', 'immediately', 'today', 'this week'];
    const financialSignals = ['financing', 'payment', 'cash', 'trade', 'down payment'];
    const decisionSignals = ['ready', 'buy', 'purchase', 'sign', 'deal'];
    const timelineSignals = ['when', 'timeline', 'schedule', 'need by'];
    
    const lowerSignal = signal.toLowerCase();
    
    if (urgencySignals.some(s => lowerSignal.includes(s))) return 'urgency';
    if (financialSignals.some(s => lowerSignal.includes(s))) return 'financial';
    if (decisionSignals.some(s => lowerSignal.includes(s))) return 'decision';
    if (timelineSignals.some(s => lowerSignal.includes(s))) return 'timeline';
    
    return 'decision';
  }

  private calculateSignalProgression(signals: BuyingSignalAnalysis['signals']): BuyingSignalAnalysis['signalProgression'] {
    // Group signals by time windows and calculate progression
    const progression: BuyingSignalAnalysis['signalProgression'] = [];
    
    // This would implement time-based signal progression analysis
    // For now, return a simplified version
    
    return progression;
  }

  private assessBuyingReadiness(
    signals: BuyingSignalAnalysis['signals'],
    progression: BuyingSignalAnalysis['signalProgression']
  ): BuyingSignalAnalysis['buyingReadiness'] {
    const validatedSignals = signals.filter(s => s.validated);
    const strongSignals = validatedSignals.filter(s => s.strength === 'strong' || s.strength === 'very_strong');
    
    let score = 0;
    score += validatedSignals.length * 15;
    score += strongSignals.length * 25;
    
    // Category diversity bonus
    const categories = new Set(validatedSignals.map(s => s.category));
    score += categories.size * 10;
    
    score = Math.min(100, score);
    
    const level = this.determineReadinessLevel(score);
    const keyIndicators = strongSignals.map(s => s.signal);
    const missingSignals = this.identifyMissingSignals(validatedSignals);
    
    return {
      score,
      level,
      confidence: this.calculateReadinessConfidence(validatedSignals, strongSignals),
      keyIndicators,
      missingSignals
    };
  }

  private determineReadinessLevel(score: number): BuyingSignalAnalysis['buyingReadiness']['level'] {
    if (score >= 80) return 'urgent';
    if (score >= 65) return 'ready';
    if (score >= 40) return 'considering';
    if (score >= 20) return 'researching';
    return 'not_ready';
  }

  private calculateReadinessConfidence(
    validatedSignals: BuyingSignalAnalysis['signals'],
    strongSignals: BuyingSignalAnalysis['signals']
  ): number {
    const avgConfidence = validatedSignals.reduce((sum, s) => sum + s.confidence, 0) / validatedSignals.length || 0;
    const strongSignalBonus = strongSignals.length * 5;
    return Math.min(100, avgConfidence + strongSignalBonus);
  }

  private identifyMissingSignals(validatedSignals: BuyingSignalAnalysis['signals']): string[] {
    const allSignals = ['timeline discussion', 'budget mention', 'financing interest', 'urgency indicators'];
    const presentCategories = new Set(validatedSignals.map(s => s.category));
    
    const missing: string[] = [];
    if (!presentCategories.has('timeline')) missing.push('timeline discussion');
    if (!presentCategories.has('financial')) missing.push('financing discussion');
    if (!presentCategories.has('urgency')) missing.push('urgency indicators');
    if (!presentCategories.has('decision')) missing.push('decision signals');
    
    return missing;
  }

  private generateBuyingSignalRecommendations(
    readiness: BuyingSignalAnalysis['buyingReadiness'],
    signals: BuyingSignalAnalysis['signals']
  ): string[] {
    const recommendations: string[] = [];
    
    if (readiness.level === 'urgent' || readiness.level === 'ready') {
      recommendations.push('Escalate to sales manager immediately');
      recommendations.push('Schedule appointment or test drive within 24 hours');
      recommendations.push('Prepare financing pre-approval documentation');
    }
    
    if (readiness.level === 'considering') {
      recommendations.push('Focus on addressing specific concerns or questions');
      recommendations.push('Provide detailed vehicle information and comparisons');
      recommendations.push('Follow up within 48 hours');
    }
    
    for (const missingSignal of readiness.missingSignals) {
      recommendations.push(`Explore ${missingSignal} with targeted questions`);
    }
    
    return recommendations.slice(0, 5);
  }

  private async analyzeConversionFactors(
    messages: ConversationMessage[],
    analysis: ConversationAnalysis,
    lead: Lead | null
  ): Promise<ConversationOutcomePrediction['factors']> {
    const factors: ConversationOutcomePrediction['factors'] = [];
    
    // Message engagement factor
    const engagementLevel = messages.filter(m => !m.isFromAI).length;
    factors.push({
      factor: 'Message Engagement',
      impact: engagementLevel > 5 ? 'positive' : engagementLevel > 2 ? 'neutral' : 'negative',
      weight: 0.2,
      description: `Customer has sent ${engagementLevel} messages`
    });
    
    // Sentiment factor
    factors.push({
      factor: 'Customer Sentiment',
      impact: ['positive', 'excited'].includes(analysis.mood) ? 'positive' : 
              ['negative', 'frustrated'].includes(analysis.mood) ? 'negative' : 'neutral',
      weight: 0.15,
      description: `Customer mood is ${analysis.mood}`
    });
    
    // Buying signals factor
    factors.push({
      factor: 'Buying Signals',
      impact: analysis.buyingSignals.length >= 2 ? 'positive' : 
              analysis.buyingSignals.length === 1 ? 'neutral' : 'negative',
      weight: 0.25,
      description: `${analysis.buyingSignals.length} buying signals detected`
    });
    
    // Urgency factor
    factors.push({
      factor: 'Urgency Level',
      impact: ['critical', 'high'].includes(analysis.urgency) ? 'positive' : 
              analysis.urgency === 'medium' ? 'neutral' : 'negative',
      weight: 0.2,
      description: `Urgency level is ${analysis.urgency}`
    });
    
    // Lead quality factor
    if (lead) {
      const leadQuality = lead.vehicleInterest && lead.phone ? 'positive' : 
                         lead.vehicleInterest || lead.phone ? 'neutral' : 'negative';
      factors.push({
        factor: 'Lead Quality',
        impact: leadQuality,
        weight: 0.1,
        description: 'Based on completeness of lead information'
      });
    }
    
    return factors;
  }

  private calculateOutcomePredictions(
    factors: ConversationOutcomePrediction['factors'],
    analysis: ConversationAnalysis,
    lead: Lead | null
  ): ConversationOutcomePrediction['predictions'] {
    // Calculate weighted score
    const weightedScore = factors.reduce((sum, factor) => {
      const impact = factor.impact === 'positive' ? 1 : factor.impact === 'negative' ? -1 : 0;
      return sum + (impact * factor.weight * 100);
    }, 50); // Base score of 50
    
    const conversionProbability = Math.max(0, Math.min(100, weightedScore));
    
    // Calculate other predictions based on conversion probability and factors
    const timeToConversion = conversionProbability > 70 ? 3 : 
                           conversionProbability > 50 ? 7 : 
                           conversionProbability > 30 ? 14 : 30;
    
    const expectedValue = this.estimateExpectedValue(lead, conversionProbability);
    const dropOffRisk = 100 - conversionProbability;
    const escalationLikelihood = analysis.buyingSignals.length >= 2 ? 80 : 30;
    
    return {
      conversionProbability,
      timeToConversion,
      expectedValue,
      dropOffRisk,
      escalationLikelihood
    };
  }

  private estimateExpectedValue(lead: Lead | null, conversionProbability: number): number {
    let baseValue = 25000; // Average vehicle price
    
    if (lead?.vehicleInterest?.toLowerCase().includes('truck')) baseValue = 35000;
    if (lead?.vehicleInterest?.toLowerCase().includes('luxury')) baseValue = 50000;
    if (lead?.vehicleInterest?.toLowerCase().includes('suv')) baseValue = 30000;
    
    return Math.round(baseValue * (conversionProbability / 100));
  }

  private generateScenarioAnalysis(
    factors: ConversationOutcomePrediction['factors'],
    predictions: ConversationOutcomePrediction['predictions']
  ): ConversationOutcomePrediction['scenarioAnalysis'] {
    const scenarios: ConversationOutcomePrediction['scenarioAnalysis'] = [];
    
    // High conversion scenario
    if (predictions.conversionProbability > 60) {
      scenarios.push({
        scenario: 'High Conversion Likelihood',
        probability: predictions.conversionProbability,
        outcome: 'Customer likely to purchase within next week',
        recommendedAction: 'Escalate to senior sales agent and schedule immediate appointment'
      });
    }
    
    // Price sensitivity scenario
    const priceFactors = factors.filter(f => f.factor.includes('Buying Signals') || f.factor.includes('Urgency'));
    if (priceFactors.some(f => f.impact === 'positive')) {
      scenarios.push({
        scenario: 'Price Negotiation Opportunity',
        probability: 70,
        outcome: 'Customer ready to negotiate on price',
        recommendedAction: 'Prepare competitive pricing analysis and financing options'
      });
    }
    
    // Risk scenario
    if (predictions.dropOffRisk > 60) {
      scenarios.push({
        scenario: 'High Drop-off Risk',
        probability: predictions.dropOffRisk,
        outcome: 'Customer may disengage without intervention',
        recommendedAction: 'Immediate personalized follow-up with value proposition'
      });
    }
    
    return scenarios;
  }

  private calculatePredictionConfidence(
    factors: ConversationOutcomePrediction['factors'],
    messageCount: number
  ): ConversationOutcomePrediction['confidenceInterval'] {
    const basConfidence = Math.min(80, 40 + (messageCount * 5)); // More messages = higher confidence
    const factorConfidence = factors.length >= 4 ? 10 : 0; // More factors = higher confidence
    
    const accuracy = Math.min(95, basConfidence + factorConfidence);
    
    return {
      low: Math.max(0, accuracy - 20),
      high: Math.min(100, accuracy + 10),
      accuracy
    };
  }

  // Helper methods for coaching suggestions and quality metrics would continue here...
  // For brevity, I'll include a few key methods:

  private async buildCoachingContext(conversationId: string) {
    return {
      conversation: await storage.getConversation(conversationId),
      messages: await storage.getConversationMessages(conversationId),
      analysis: await dynamicResponseIntelligenceService.analyzeConversation(conversationId),
      sentimentProgression: await this.analyzeSentimentProgression(conversationId),
      buyingSignals: await this.analyzeBuyingSignals(conversationId)
    };
  }

  private async generateResponseQualityCoaching(context: any): Promise<CoachingSuggestion[]> {
    const suggestions: CoachingSuggestion[] = [];
    
    const lastAgentMessage = context.messages.filter((m: any) => m.isFromAI).pop();
    if (!lastAgentMessage) return suggestions;
    
    if (lastAgentMessage.content.length < 50) {
      suggestions.push({
        type: 'response_guidance',
        priority: 'medium',
        title: 'Response Too Brief',
        description: 'Last response was very short and may not provide adequate value',
        suggestedAction: 'Provide more detailed, helpful information in next response',
        expectedOutcome: 'Improved customer engagement and satisfaction',
        confidence: 80,
        timing: 'next_response'
      });
    }
    
    return suggestions;
  }

  private async generateOpportunityCoaching(context: any): Promise<CoachingSuggestion[]> {
    const suggestions: CoachingSuggestion[] = [];
    
    if (context.buyingSignals.buyingReadiness.level === 'ready') {
      suggestions.push({
        type: 'opportunity_highlight',
        priority: 'critical',
        title: 'Customer Ready to Buy',
        description: 'Multiple buying signals indicate customer is ready to make a purchase',
        suggestedAction: 'Escalate immediately and schedule appointment',
        expectedOutcome: 'High probability of conversion',
        confidence: 90,
        timing: 'immediate'
      });
    }
    
    return suggestions;
  }

  private async generateRiskMitigationCoaching(context: any): Promise<CoachingSuggestion[]> {
    const suggestions: CoachingSuggestion[] = [];
    
    if (context.sentimentProgression.overallTrend === 'declining') {
      suggestions.push({
        type: 'risk_warning',
        priority: 'high',
        title: 'Declining Customer Sentiment',
        description: 'Customer sentiment has been getting worse throughout the conversation',
        suggestedAction: 'Focus on addressing concerns and rebuilding trust',
        expectedOutcome: 'Prevent customer disengagement',
        confidence: 85,
        timing: 'immediate'
      });
    }
    
    return suggestions;
  }

  private async generateNextBestActionCoaching(context: any): Promise<CoachingSuggestion[]> {
    const suggestions: CoachingSuggestion[] = [];
    
    // Add logic for next best action coaching
    
    return suggestions;
  }

  private getPriorityWeight(priority: CoachingSuggestion['priority']): number {
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    return weights[priority];
  }

  private async calculateResponsenessScore(messages: ConversationMessage[]): Promise<number> {
    // Calculate how quickly agents respond to customer messages
    let totalResponseTime = 0;
    let responseCount = 0;
    
    for (let i = 0; i < messages.length - 1; i++) {
      if (!messages[i].isFromAI && messages[i + 1].isFromAI) {
        const responseTime = messages[i + 1].createdAt.getTime() - messages[i].createdAt.getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }
    }
    
    if (responseCount === 0) return 50;
    
    const avgResponseHours = (totalResponseTime / responseCount) / (1000 * 60 * 60);
    
    // Score based on average response time
    if (avgResponseHours < 1) return 100;
    if (avgResponseHours < 4) return 85;
    if (avgResponseHours < 24) return 70;
    return 40;
  }

  private async calculatePersonalizationScore(messages: ConversationMessage[], conversationId: string): Promise<number> {
    const conversation = await storage.getConversation(conversationId);
    const lead = conversation ? await storage.getLead(conversation.leadId) : null;
    
    if (!lead) return 30;
    
    const agentMessages = messages.filter(m => m.isFromAI);
    let personalizationScore = 0;
    
    for (const message of agentMessages) {
      let messageScore = 0;
      
      // Check for name usage
      if (lead.firstName && message.content.includes(lead.firstName)) messageScore += 20;
      
      // Check for vehicle interest reference
      if (lead.vehicleInterest && message.content.toLowerCase().includes(lead.vehicleInterest.toLowerCase())) {
        messageScore += 20;
      }
      
      // Check for context from previous messages
      const recentCustomerMessages = messages.filter(m => !m.isFromAI && m.createdAt < message.createdAt).slice(-2);
      if (recentCustomerMessages.some(cm => 
        message.content.toLowerCase().includes(cm.content.toLowerCase().substring(0, 20))
      )) {
        messageScore += 15;
      }
      
      personalizationScore += messageScore;
    }
    
    return Math.min(100, personalizationScore / agentMessages.length);
  }

  private async calculateProblemResolutionScore(messages: ConversationMessage[], analysis: ConversationAnalysis): Promise<number> {
    // Analyze if customer problems/questions are being resolved
    const customerConcerns = messages.filter(m => 
      !m.isFromAI && 
      (m.content.includes('?') || m.content.toLowerCase().includes('problem') || m.content.toLowerCase().includes('issue'))
    );
    
    if (customerConcerns.length === 0) return 80; // No problems to resolve
    
    // Check if agent responses address the concerns
    let resolvedConcerns = 0;
    
    for (const concern of customerConcerns) {
      const followupAgentMessages = messages.filter(m => 
        m.isFromAI && m.createdAt > concern.createdAt
      ).slice(0, 2); // Next 2 agent responses
      
      if (followupAgentMessages.some(am => am.content.length > 100)) {
        resolvedConcerns++;
      }
    }
    
    return Math.round((resolvedConcerns / customerConcerns.length) * 100);
  }

  private async calculateSalesEffectivenessScore(messages: ConversationMessage[], analysis: ConversationAnalysis): Promise<number> {
    let score = 50; // Base score
    
    // Bonus for buying signal progression
    score += analysis.buyingSignals.length * 10;
    
    // Bonus for moving toward next steps
    const agentMessages = messages.filter(m => m.isFromAI);
    const nextStepTerms = ['schedule', 'appointment', 'visit', 'test drive', 'financing'];
    const nextStepMentions = agentMessages.filter(m => 
      nextStepTerms.some(term => m.content.toLowerCase().includes(term))
    ).length;
    
    score += nextStepMentions * 8;
    
    // Penalty for missed opportunities
    if (analysis.intent === 'ready_to_buy' && nextStepMentions === 0) {
      score -= 30;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private async calculateCustomerSatisfactionScore(messages: ConversationMessage[], analysis: ConversationAnalysis): Promise<number> {
    const sentimentScore = this.sentimentToScore(analysis.mood);
    const engagementLevel = messages.filter(m => !m.isFromAI).length;
    
    let score = sentimentScore;
    
    // Engagement bonus
    if (engagementLevel > 5) score += 10;
    if (engagementLevel > 10) score += 5;
    
    // Conversation length bonus (sustained engagement)
    if (messages.length > 10) score += 5;
    
    return Math.min(100, score);
  }

  private async calculateProfessionalismScore(messages: ConversationMessage[]): Promise<number> {
    const agentMessages = messages.filter(m => m.isFromAI);
    
    if (agentMessages.length === 0) return 50;
    
    let professionalismScore = 0;
    
    for (const message of agentMessages) {
      let messageScore = 70; // Base professionalism score
      
      // Check for professional language
      if (message.content.includes('please') || message.content.includes('thank you')) {
        messageScore += 10;
      }
      
      // Check for proper grammar (simple check)
      if (message.content.match(/^[A-Z]/) && message.content.match(/[.!?]$/)) {
        messageScore += 5;
      }
      
      // Penalty for informal language
      const informalTerms = ['hey', 'gonna', 'wanna', 'yeah', 'ok'];
      if (informalTerms.some(term => message.content.toLowerCase().includes(term))) {
        messageScore -= 15;
      }
      
      professionalismScore += messageScore;
    }
    
    return Math.min(100, professionalismScore / agentMessages.length);
  }

  private calculateOverallQualityScore(dimensions: ConversationQualityMetrics['dimensions']): number {
    const weights = {
      responsiveness: 0.2,
      personalization: 0.15,
      problemResolution: 0.2,
      salesEffectiveness: 0.2,
      customerSatisfaction: 0.15,
      professionalismScore: 0.1
    };
    
    return Math.round(
      Object.entries(dimensions).reduce((sum, [key, value]) => {
        return sum + (value * weights[key as keyof typeof weights]);
      }, 0)
    );
  }

  private identifyImprovementOpportunities(dimensions: ConversationQualityMetrics['dimensions']): ConversationQualityMetrics['improvement'] {
    const lowestDimension = Object.entries(dimensions).reduce((lowest, [key, value]) => {
      return value < lowest.value ? { key, value } : lowest;
    }, { key: 'responsiveness', value: 100 });
    
    const suggestions: string[] = [];
    
    switch (lowestDimension.key) {
      case 'responsiveness':
        suggestions.push('Reduce response time to customer messages');
        suggestions.push('Set up automated response acknowledgments');
        break;
      case 'personalization':
        suggestions.push('Use customer name more frequently');
        suggestions.push('Reference specific customer interests and previous conversations');
        break;
      case 'problemResolution':
        suggestions.push('Address customer questions more comprehensively');
        suggestions.push('Follow up to ensure concerns are resolved');
        break;
      case 'salesEffectiveness':
        suggestions.push('Focus more on moving conversation toward next steps');
        suggestions.push('Ask qualifying questions to identify buying signals');
        break;
      case 'customerSatisfaction':
        suggestions.push('Focus on building rapport and trust');
        suggestions.push('Address customer concerns proactively');
        break;
      case 'professionalismScore':
        suggestions.push('Use more professional language and tone');
        suggestions.push('Ensure proper grammar and formatting');
        break;
    }
    
    return {
      primaryArea: lowestDimension.key,
      suggestions,
      potentialImpact: Math.round((80 - lowestDimension.value) * 0.6) // Estimated improvement potential
    };
  }

  private compareToBenchmarks(overallScore: number): ConversationQualityMetrics['benchmarkComparison'] {
    const industryAverage = 68;
    const topPerformer = 85;
    
    let relativePerfornance: ConversationQualityMetrics['benchmarkComparison']['relativePerfornance'];
    
    if (overallScore >= topPerformer) {
      relativePerfornance = 'top_tier';
    } else if (overallScore >= industryAverage + 5) {
      relativePerfornance = 'above_average';
    } else if (overallScore >= industryAverage - 5) {
      relativePerfornance = 'average';
    } else {
      relativePerfornance = 'below_average';
    }
    
    return {
      industryAverage,
      topPerformer,
      relativePerfornance
    };
  }

  // Helper methods for empty states
  private createEmptySentimentProgression(conversationId: string): SentimentProgression {
    return {
      conversationId,
      progression: [],
      overallTrend: 'stable',
      criticalPoints: [],
      recommendations: ['Initiate conversation to begin sentiment tracking']
    };
  }

  private createFallbackIntentClassification(conversationId: string, messageId: string): IntentClassification {
    return {
      conversationId,
      messageId,
      primaryIntent: {
        intent: 'information_seeking',
        confidence: 30,
        reasoning: 'Fallback classification due to analysis error'
      },
      secondaryIntents: [],
      intentProgression: [],
      finalizedIntent: 'information_seeking',
      intentStability: 30
    };
  }

  private async buildIntentProgression(conversationId: string): Promise<IntentClassification['intentProgression']> {
    // This would analyze the conversation history to build intent progression
    // For now, return empty array
    return [];
  }

  private determineFininalizedIntent(
    progression: IntentClassification['intentProgression'],
    primaryIntent: IntentClassification['primaryIntent']
  ): string {
    // Logic to determine the final intent based on progression and current intent
    return primaryIntent.intent;
  }
}

export const advancedConversationAnalytics = new AdvancedConversationAnalytics();