import { getOpenAIClient } from './openai';
import { dynamicResponseIntelligenceService, type ConversationAnalysis } from './dynamic-response-intelligence';
import { leadScoringService } from './lead-scoring';
import { storage } from '../storage';
import { searchMemories, extractMemoryContent } from './supermemory';
import type { Conversation, ConversationMessage, Lead, AiAgentConfig } from '@shared/schema';

/**
 * Enhanced Conversation AI Service
 * 
 * Provides advanced conversation intelligence with automotive expertise,
 * context-aware response generation, and multi-turn conversation flow management.
 * 
 * Features:
 * - Automotive industry expertise and terminology
 * - Context-aware response generation using conversation history
 * - Lead profile personalization
 * - Buying signal detection and escalation
 * - Multi-turn conversation memory
 * - Response quality optimization
 */

export interface ConversationContext {
  leadId: string;
  conversationId: string;
  leadProfile: Lead;
  conversationHistory: ConversationMessage[];
  currentAnalysis: ConversationAnalysis;
  leadScore: number;
  priority: 'hot' | 'warm' | 'cold';
  previousResponses: string[];
  memoryContext?: string;
}

export interface ResponseGenerationOptions {
  responseType: 'informational' | 'sales_focused' | 'service_oriented' | 'followup' | 'escalation';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  includeVehicleDetails?: boolean;
  includeFinancingOptions?: boolean;
  includeIncentives?: boolean;
  tone: 'professional' | 'friendly' | 'enthusiastic' | 'urgent';
  maxResponseLength?: number;
  personalizationLevel: 'basic' | 'moderate' | 'high';
}

export interface EnhancedResponse {
  content: string;
  responseType: ResponseGenerationOptions['responseType'];
  confidence: number;
  suggestedFollowUpActions: string[];
  escalationRecommended: boolean;
  buyingSignalsDetected: string[];
  nextStepSuggestions: string[];
  qualityScore: number;
  personalizationElements: string[];
}

export interface AutomotiveKnowledgeBase {
  vehicleTypes: Record<string, {
    features: string[];
    benefits: string[];
    commonQuestions: string[];
    sellingPoints: string[];
  }>;
  financingOptions: {
    loan: string[];
    lease: string[];
    cashIncentives: string[];
  };
  servicePackages: string[];
  seasonalOffers: Record<string, string[]>;
  competitorResponses: Record<string, string>;
}

export class EnhancedConversationAI {
  private automotiveKnowledge: AutomotiveKnowledgeBase;
  
  constructor() {
    this.automotiveKnowledge = this.initializeAutomotiveKnowledge();
  }

  /**
   * Generate enhanced AI response with automotive expertise and context awareness
   */
  async generateContextAwareResponse(
    conversationContext: ConversationContext,
    newMessage: string,
    options: ResponseGenerationOptions
  ): Promise<EnhancedResponse> {
    
    // Analyze the new message for intent and buying signals
    const messageAnalysis = await this.analyzeIncomingMessage(newMessage, conversationContext);
    
    // Get relevant memories and context
    const memoryContext = await this.retrieveRelevantMemories(
      conversationContext.leadId, 
      newMessage,
      conversationContext.leadProfile?.vehicleInterest || undefined
    );
    
    // Generate the response using advanced prompting
    const response = await this.generateAutomotiveResponse(
      conversationContext,
      newMessage,
      messageAnalysis,
      memoryContext,
      options
    );
    
    // Calculate quality score and enhancements
    const qualityScore = await this.calculateResponseQuality(response, conversationContext);
    const personalizationElements = this.identifyPersonalizationElements(response, conversationContext);
    
    return {
      content: response,
      responseType: options.responseType,
      confidence: this.calculateConfidence(messageAnalysis, conversationContext),
      suggestedFollowUpActions: await this.generateFollowUpActions(messageAnalysis, conversationContext),
      escalationRecommended: this.shouldEscalate(messageAnalysis, conversationContext),
      buyingSignalsDetected: messageAnalysis.buyingSignals,
      nextStepSuggestions: this.generateNextSteps(messageAnalysis, conversationContext, options),
      qualityScore,
      personalizationElements
    };
  }

  /**
   * Analyze incoming message for intent, urgency, and buying signals
   */
  private async analyzeIncomingMessage(
    message: string, 
    context: ConversationContext
  ): Promise<{
    intent: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    buyingSignals: string[];
    questions: string[];
    concerns: string[];
    requestedInfo: string[];
  }> {
    const client = getOpenAIClient();
    
    const analysisPrompt = `
    Analyze this automotive customer message for sales intelligence:
    
    Message: "${message}"
    
    Lead Profile: ${context.leadProfile.firstName} ${context.leadProfile.lastName}
    Vehicle Interest: ${context.leadProfile.vehicleInterest || 'Not specified'}
    Lead Score: ${context.leadScore}/100 (${context.priority})
    
    Previous conversation context: ${context.conversationHistory.slice(-3).map(m => 
      `${m.isFromAI ? 'Agent' : 'Customer'}: ${m.content}`
    ).join('\n')}
    
    Analyze and return JSON with:
    {
      "intent": "information_seeking|price_inquiry|test_drive|financing|service|complaint|ready_to_buy|comparison_shopping",
      "urgency": "low|medium|high|critical", 
      "buyingSignals": ["array of detected buying signals"],
      "questions": ["explicit questions asked"],
      "concerns": ["concerns or objections raised"],
      "requestedInfo": ["specific information requested"]
    }
    
    Focus on automotive industry context and sales indicators.
    `;

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert automotive sales analyst. Analyze customer messages for buying intent, urgency, and sales opportunities with precision."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('Message analysis error:', error);
      return {
        intent: 'information_seeking',
        urgency: 'medium',
        buyingSignals: [],
        questions: [],
        concerns: [],
        requestedInfo: []
      };
    }
  }

  /**
   * Generate automotive-focused AI response with industry expertise
   */
  private async generateAutomotiveResponse(
    context: ConversationContext,
    newMessage: string,
    messageAnalysis: any,
    memoryContext: string,
    options: ResponseGenerationOptions
  ): Promise<string> {
    const client = getOpenAIClient();
    
    // Build comprehensive automotive system prompt
    const systemPrompt = this.buildAutomotiveSystemPrompt(context, options);
    
    // Build contextualized user prompt
    const userPrompt = this.buildContextualizedPrompt(
      context,
      newMessage,
      messageAnalysis,
      memoryContext,
      options
    );

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: this.calculateTemperature(options.responseType, context.priority),
        max_tokens: options.maxResponseLength || 300,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      return response.choices[0].message.content || "I'd be happy to help you with that. Let me get more information for you.";
    } catch (error) {
      console.error('Response generation error:', error);
      return this.generateFallbackResponse(messageAnalysis, context);
    }
  }

  /**
   * Build comprehensive automotive system prompt
   */
  private buildAutomotiveSystemPrompt(
    context: ConversationContext,
    options: ResponseGenerationOptions
  ): string {
    const { leadProfile, currentAnalysis } = context;
    
    return `You are an expert automotive sales professional with deep industry knowledge and customer service excellence. 

    CUSTOMER PROFILE:
    - Name: ${leadProfile.firstName} ${leadProfile.lastName}
    - Vehicle Interest: ${leadProfile.vehicleInterest || 'Exploring options'}
    - Lead Source: ${leadProfile.leadSource || 'Website'}
    - Current Mood: ${currentAnalysis.mood}
    - Buying Intent: ${currentAnalysis.intent}
    - Priority Level: ${context.priority.toUpperCase()}

    CONVERSATION GUIDELINES:
    - Response Type: ${options.responseType.replace('_', ' ')}
    - Tone: ${options.tone}
    - Urgency Level: ${options.urgency}
    - Personalization: ${options.personalizationLevel}

    AUTOMOTIVE EXPERTISE:
    - Know all major vehicle makes, models, features, and specifications
    - Understand financing options: loans, leases, incentives, trade-ins
    - Provide service scheduling and maintenance guidance
    - Handle competitive comparisons professionally
    - Recognize and respond to buying signals appropriately

    RESPONSE REQUIREMENTS:
    1. Always be helpful, knowledgeable, and professional
    2. Use automotive industry terminology appropriately
    3. Personalize responses using customer information
    4. Provide specific, actionable next steps
    5. Include relevant vehicle features/benefits when appropriate
    6. Mention financing options when contextually relevant
    7. Create urgency without being pushy
    8. Ask qualifying questions to move the sale forward

    ESCALATION TRIGGERS:
    - High-value buying signals detected
    - Customer ready to schedule test drive or visit
    - Financing/pricing discussions
    - Competitive pressure situations
    - Service complaints requiring management attention

    Respond as a knowledgeable automotive professional who understands this customer's needs and can guide them toward their perfect vehicle match.`;
  }

  /**
   * Build contextualized user prompt with conversation history and analysis
   */
  private buildContextualizedPrompt(
    context: ConversationContext,
    newMessage: string,
    messageAnalysis: any,
    memoryContext: string,
    options: ResponseGenerationOptions
  ): string {
    const recentHistory = context.conversationHistory.slice(-5).map(m => 
      `${m.isFromAI ? 'You' : 'Customer'}: ${m.content}`
    ).join('\n');

    return `
    RECENT CONVERSATION HISTORY:
    ${recentHistory}

    CUSTOMER'S NEW MESSAGE:
    "${newMessage}"

    MESSAGE ANALYSIS:
    - Intent: ${messageAnalysis.intent}
    - Urgency: ${messageAnalysis.urgency}
    - Buying Signals: ${messageAnalysis.buyingSignals.join(', ') || 'None detected'}
    - Questions Asked: ${messageAnalysis.questions.join(', ') || 'None'}
    - Concerns Raised: ${messageAnalysis.concerns.join(', ') || 'None'}
    - Info Requested: ${messageAnalysis.requestedInfo.join(', ') || 'None'}

    ${memoryContext ? `RELEVANT CONTEXT FROM MEMORY:\n${memoryContext}` : ''}

    RESPONSE REQUIREMENTS:
    ${options.includeVehicleDetails ? '- Include specific vehicle details and features' : ''}
    ${options.includeFinancingOptions ? '- Mention relevant financing options' : ''}
    ${options.includeIncentives ? '- Include current incentives or offers' : ''}

    Generate a ${options.tone} response that addresses their message directly and moves the conversation toward ${options.responseType === 'sales_focused' ? 'a sale' : options.responseType === 'service_oriented' ? 'service resolution' : 'information fulfillment'}.

    Keep response under ${options.maxResponseLength || 300} words and ensure it's personalized and actionable.
    `;
  }

  /**
   * Retrieve relevant memories and context for the conversation
   */
  private async retrieveRelevantMemories(
    leadId: string,
    currentMessage: string,
    vehicleInterest?: string
  ): Promise<string> {
    try {
      // Search for relevant memories based on the lead and current context
      const searchQueries = [
        `${leadId} conversation history`,
        `${vehicleInterest} features benefits`,
        `${currentMessage.substring(0, 50)} context`
      ].filter(Boolean);

      let memoryContext = '';
      
      for (const query of searchQueries) {
        try {
          const memories = await searchMemories(query, 3);
          if (memories.length > 0) {
            const content = await Promise.all(
              memories.map(m => extractMemoryContent(m.id))
            );
            memoryContext += content.filter(Boolean).join('\n') + '\n';
          }
        } catch (error) {
          console.debug('Memory retrieval error for query:', query, error);
        }
      }

      return memoryContext.trim();
    } catch (error) {
      console.debug('Memory context retrieval failed:', error);
      return '';
    }
  }

  /**
   * Calculate response confidence based on analysis and context
   */
  private calculateConfidence(messageAnalysis: any, context: ConversationContext): number {
    let confidence = 70; // Base confidence

    // Higher confidence for clear intent
    if (['ready_to_buy', 'test_drive', 'financing'].includes(messageAnalysis.intent)) {
      confidence += 15;
    }

    // Confidence boost for high-priority leads
    if (context.priority === 'hot') confidence += 10;
    if (context.priority === 'warm') confidence += 5;

    // More conversation history = higher confidence
    confidence += Math.min(15, context.conversationHistory.length * 2);

    // Buying signals boost confidence
    confidence += Math.min(10, messageAnalysis.buyingSignals.length * 3);

    return Math.min(100, confidence);
  }

  /**
   * Generate suggested follow-up actions based on analysis
   */
  private async generateFollowUpActions(
    messageAnalysis: any,
    context: ConversationContext
  ): Promise<string[]> {
    const actions: string[] = [];

    // Intent-based actions
    switch (messageAnalysis.intent) {
      case 'ready_to_buy':
        actions.push('Schedule immediate call or appointment');
        actions.push('Prepare financing pre-approval paperwork');
        actions.push('Check vehicle availability and pricing');
        break;
      case 'test_drive':
        actions.push('Schedule test drive appointment');
        actions.push('Confirm vehicle availability for test drive');
        actions.push('Prepare vehicle comparison sheet');
        break;
      case 'financing':
        actions.push('Connect with finance manager');
        actions.push('Gather credit pre-qualification information');
        actions.push('Prepare financing options presentation');
        break;
      case 'price_inquiry':
        actions.push('Prepare competitive pricing analysis');
        actions.push('Calculate incentives and trade-in value');
        actions.push('Schedule pricing discussion call');
        break;
    }

    // Urgency-based actions
    if (messageAnalysis.urgency === 'critical' || messageAnalysis.urgency === 'high') {
      actions.push('Escalate to sales manager immediately');
      actions.push('Call within 30 minutes');
    }

    // Lead score-based actions
    if (context.priority === 'hot') {
      actions.push('Priority handling - respond within 15 minutes');
    }

    return actions.slice(0, 5); // Limit to top 5 actions
  }

  /**
   * Determine if conversation should be escalated
   */
  private shouldEscalate(messageAnalysis: any, context: ConversationContext): boolean {
    // High-value buying signals
    const highValueSignals = ['ready to buy', 'sign today', 'cash buyer', 'pre-approved'];
    if (messageAnalysis.buyingSignals.some((signal: string) => 
      highValueSignals.some(hvs => signal.includes(hvs))
    )) {
      return true;
    }

    // Critical urgency or hot leads with financing intent
    if (messageAnalysis.urgency === 'critical') return true;
    if (context.priority === 'hot' && messageAnalysis.intent === 'financing') return true;

    // Multiple concerns or complex requests
    if (messageAnalysis.concerns.length >= 2) return true;

    return false;
  }

  /**
   * Generate next step suggestions
   */
  private generateNextSteps(
    messageAnalysis: any,
    context: ConversationContext,
    options: ResponseGenerationOptions
  ): string[] {
    const steps: string[] = [];

    if (messageAnalysis.questions.length > 0) {
      steps.push('Provide detailed answers to customer questions');
    }

    if (messageAnalysis.concerns.length > 0) {
      steps.push('Address customer concerns with solutions');
    }

    if (options.responseType === 'sales_focused') {
      steps.push('Move conversation toward appointment scheduling');
      steps.push('Qualify budget and timeline');
    }

    if (context.priority === 'hot') {
      steps.push('Schedule immediate follow-up call');
    }

    return steps;
  }

  /**
   * Calculate response quality score
   */
  private async calculateResponseQuality(
    response: string,
    context: ConversationContext
  ): Promise<number> {
    let score = 60; // Base score

    // Length appropriateness
    if (response.length >= 100 && response.length <= 400) score += 10;

    // Personalization check
    const personalizedElements = [
      context.leadProfile.firstName,
      context.leadProfile.vehicleInterest
    ].filter(el => el && response.toLowerCase().includes(el.toLowerCase()));
    
    score += personalizedElements.length * 5;

    // Automotive terminology usage
    const automotiveTerms = ['vehicle', 'financing', 'test drive', 'lease', 'warranty', 'service'];
    const termsUsed = automotiveTerms.filter(term => 
      response.toLowerCase().includes(term)
    ).length;
    score += Math.min(15, termsUsed * 3);

    // Call-to-action presence
    const ctaTerms = ['schedule', 'visit', 'call', 'appointment', 'contact'];
    if (ctaTerms.some(cta => response.toLowerCase().includes(cta))) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Identify personalization elements in the response
   */
  private identifyPersonalizationElements(
    response: string,
    context: ConversationContext
  ): string[] {
    const elements: string[] = [];
    const responseLC = response.toLowerCase();

    if (context.leadProfile.firstName && responseLC.includes(context.leadProfile.firstName.toLowerCase())) {
      elements.push('Customer name usage');
    }

    if (context.leadProfile.vehicleInterest && responseLC.includes(context.leadProfile.vehicleInterest.toLowerCase())) {
      elements.push('Vehicle interest reference');
    }

    if (context.leadProfile.leadSource && responseLC.includes(context.leadProfile.leadSource.toLowerCase())) {
      elements.push('Lead source acknowledgment');
    }

    // Check for conversation history references
    const recentTopics = context.conversationHistory.slice(-3)
      .map(m => m.content.toLowerCase())
      .join(' ');
    
    if (recentTopics.includes('financing') && responseLC.includes('financing')) {
      elements.push('Previous financing discussion reference');
    }

    return elements;
  }

  /**
   * Calculate temperature for AI response generation
   */
  private calculateTemperature(responseType: string, priority: string): number {
    let temp = 0.7; // Default temperature

    if (responseType === 'informational') temp = 0.3; // More deterministic
    if (responseType === 'sales_focused') temp = 0.8; // More creative
    if (responseType === 'escalation') temp = 0.4; // Professional and consistent

    if (priority === 'hot') temp = Math.max(0.3, temp - 0.2); // More careful for hot leads

    return temp;
  }

  /**
   * Generate fallback response when AI generation fails
   */
  private generateFallbackResponse(messageAnalysis: any, context: ConversationContext): string {
    const name = context.leadProfile.firstName ? `, ${context.leadProfile.firstName}` : '';
    
    if (messageAnalysis.intent === 'ready_to_buy') {
      return `Thank you for your interest${name}! I'd love to help you move forward with your vehicle purchase. Let me connect you with our sales team to schedule an appointment. When would be a good time for you?`;
    }
    
    if (messageAnalysis.intent === 'financing') {
      return `Great question about financing${name}! We have excellent financing options available. I'd like to connect you with our finance team to discuss the best options for your situation. Can we schedule a quick call?`;
    }
    
    return `Thank you for your message${name}! I want to make sure I give you the most accurate information. Let me get the details you need and get back to you shortly. Is there anything specific about ${context.leadProfile.vehicleInterest || 'our vehicles'} you'd like to know?`;
  }

  /**
   * Initialize automotive industry knowledge base
   */
  private initializeAutomotiveKnowledge(): AutomotiveKnowledgeBase {
    return {
      vehicleTypes: {
        sedan: {
          features: ['fuel efficiency', 'comfort', 'trunk space', 'safety features'],
          benefits: ['lower cost of ownership', 'easy parking', 'good resale value'],
          commonQuestions: ['fuel economy', 'trunk space', 'maintenance costs'],
          sellingPoints: ['reliability', 'comfort', 'value']
        },
        suv: {
          features: ['cargo space', 'all-wheel drive', 'higher seating position', 'towing capacity'],
          benefits: ['versatility', 'safety', 'family-friendly', 'weather handling'],
          commonQuestions: ['towing capacity', 'fuel economy', 'cargo space'],
          sellingPoints: ['versatility', 'safety', 'capability']
        },
        truck: {
          features: ['towing capacity', 'payload', 'bed size', 'four-wheel drive'],
          benefits: ['work capability', 'durability', 'resale value'],
          commonQuestions: ['towing capacity', 'payload', 'fuel economy'],
          sellingPoints: ['capability', 'durability', 'versatility']
        }
      },
      financingOptions: {
        loan: ['competitive APR', '60-month terms', '84-month extended terms', 'no prepayment penalty'],
        lease: ['lower monthly payments', 'warranty coverage', 'newer vehicle features', 'flexibility'],
        cashIncentives: ['rebates', 'loyalty discounts', 'conquest incentives', 'seasonal promotions']
      },
      servicePackages: ['extended warranty', 'maintenance packages', 'tire protection', 'GAP insurance'],
      seasonalOffers: {
        spring: ['service specials', 'tire rotation', 'maintenance packages'],
        summer: ['road trip preparation', 'A/C service', 'tire specials'],
        fall: ['winterization', 'battery service', 'heating system check'],
        winter: ['year-end clearance', 'holiday incentives', 'winter tire packages']
      },
      competitorResponses: {
        'other dealers': 'We focus on providing exceptional value through our service, warranty coverage, and customer experience.',
        'better price': 'Let me show you our total value proposition including financing, warranty, and service benefits.',
        'shopping around': 'Smart approach! Let me make sure you have all the information to make the best decision.'
      }
    };
  }

  /**
   * Get conversation suggestions for agents
   */
  async getConversationSuggestions(conversationContext: ConversationContext): Promise<{
    quickResponses: string[];
    recommendedQuestions: string[];
    escalationReasons: string[];
  }> {
    const { currentAnalysis, leadProfile } = conversationContext;
    
    const quickResponses = [
      `Thanks for your interest in ${leadProfile.vehicleInterest || 'our vehicles'}, ${leadProfile.firstName}!`,
      "I'd be happy to help you with that information.",
      "Let me check on availability and pricing for you.",
      "Would you like to schedule a test drive?"
    ];

    const recommendedQuestions = [
      "What's your ideal timeline for purchasing?",
      "Are you looking to finance or lease?",
      "Do you have a vehicle to trade in?",
      "What features are most important to you?"
    ];

    const escalationReasons = [
      currentAnalysis.urgency === 'critical' ? 'Critical urgency detected' : '',
      currentAnalysis.buyingSignals.length >= 3 ? 'Multiple buying signals present' : '',
      currentAnalysis.intent === 'ready_to_buy' ? 'Customer expressed ready to buy' : ''
    ].filter(Boolean);

    return {
      quickResponses,
      recommendedQuestions,
      escalationReasons
    };
  }
}

export const enhancedConversationAI = new EnhancedConversationAI();