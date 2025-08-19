import { getOpenAIClient } from './openai';
import { dynamicResponseIntelligenceService, type ConversationAnalysis } from './dynamic-response-intelligence';
import { leadScoringService } from './lead-scoring';
import { storage } from '../storage';
import { searchMemories, extractMemoryContent } from './supermemory';
import { kbAIIntegration } from './kb-ai-integration';
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
  
  // Quality Validation Pipeline Feature Flag
  private static readonly ENABLE_QUALITY_VALIDATION = true;
  
  // Automotive Quality Validators
  private static readonly AUTOMOTIVE_QUALITY_VALIDATORS = {
    industryTerms: ['vehicle', 'financing', 'test drive', 'lease', 'warranty', 'service', 'trade-in', 'dealership', 'monthly payment', 'down payment', 'APR', 'credit', 'insurance'],
    brandMentions: /\b(ford|toyota|honda|chevrolet|bmw|mercedes|audi|nissan|hyundai|kia|subaru|mazda|volkswagen|jeep|ram|gmc|lexus|acura|infiniti|cadillac|buick|lincoln|volvo|jaguar|land rover|porsche|tesla|genesis)\b/i,
    actionableContent: /\b(schedule|visit|call|contact|appointment|quote|estimate|test drive|financing|apply|submit|come in|stop by|meet|discuss)\b/i,
    avoidHallucinations: {
      specificPrices: /\$[\d,]+(?!.*\bstarting|around|approximately\b)/,
      specificDates: /\b(today|tomorrow|this weekend)\b(?!\s+(?:if|when|after))/,
      guarantees: /\bguarantee[sd]?\b|\bpromise[sd]?\b/i,
      specificInventory: /\b(we have|in stock|available now)\s+\d+\s+(vehicles?|cars?|trucks?)\b/i,
      exactTimes: /\b(at exactly|precisely at|sharp at)\b/i
    }
  };
  
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

    // Get knowledge base context
    const kbContext = await kbAIIntegration.getConversationContextWithKB(
      conversationContext, 
      options
    );
    
    // Generate the response using advanced prompting with KB context
    const response = await this.generateAutomotiveResponse(
      conversationContext,
      newMessage,
      messageAnalysis,
      memoryContext,
      options,
      kbContext
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
    options: ResponseGenerationOptions,
    kbContext?: any
  ): Promise<string> {
    const client = getOpenAIClient();
    
    // Build comprehensive automotive system prompt
    const systemPrompt = this.buildAutomotiveSystemPrompt(context, options);
    
    // Build contextualized user prompt with KB context
    const userPrompt = this.buildContextualizedPrompt(
      context,
      newMessage,
      messageAnalysis,
      memoryContext,
      options,
      kbContext
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

      const generatedResponse = response.choices[0].message.content || "I'd be happy to help you with that. Let me get more information for you.";
      
      // Apply quality validation if enabled
      if (EnhancedConversationAI.ENABLE_QUALITY_VALIDATION) {
        try {
          return await this.validateAndEnhanceResponse(generatedResponse, context, messageAnalysis);
        } catch (validationError) {
          console.warn('Quality validation failed, returning original response:', validationError);
          return generatedResponse;
        }
      }
      
      return generatedResponse;
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

    EMAIL FORMATTING REQUIREMENTS:
    - Use proper paragraph breaks with double line breaks (\n\n)
    - Keep paragraphs to 1-3 sentences each
    - Use bullet points for lists (- item 1\n- item 2)
    - Start with friendly greeting
    - End with clear call-to-action
    - Maximum 150 words total
    - Professional but conversational tone
    - NO wall of text - break up content for easy reading

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
    options: ResponseGenerationOptions,
    kbContext?: any
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

    ${kbContext?.hasKBData ? `KNOWLEDGE BASE CONTEXT:\n${kbContext.kbContext}\n\nKnowledge Sources: ${kbContext.kbSources.map((s: any) => s.title).join(', ')}` : ''}

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
   * Validate and enhance AI response with quality checks and automotive expertise
   */
  private async validateAndEnhanceResponse(
    originalResponse: string,
    context: ConversationContext,
    messageAnalysis: any
  ): Promise<string> {
    try {
      // Step 1: Check for hallucinations and sanitize if needed
      const sanitizedResponse = this.sanitizeHallucinations(originalResponse, context);
      
      // Step 2: Calculate advanced quality score
      const qualityMetrics = this.calculateAdvancedQuality(sanitizedResponse, context);
      
      // Step 3: Enhance with automotive context if quality is low
      let enhancedResponse = sanitizedResponse;
      if (qualityMetrics.overall < 75) {
        enhancedResponse = this.addAutomotiveContext(sanitizedResponse, context, messageAnalysis);
      }
      
      // Step 4: Log quality metrics for monitoring
      console.log('Quality Validation Metrics:', {
        leadId: context.leadId,
        originalScore: qualityMetrics.overall,
        hasHallucinations: qualityMetrics.hasHallucinations,
        automotiveTermsCount: qualityMetrics.automotiveTermsCount,
        hasActionableContent: qualityMetrics.hasActionableContent
      });
      
      return enhancedResponse;
    } catch (error) {
      console.error('Response validation error:', error);
      return originalResponse; // Always return original if validation fails
    }
  }

  /**
   * Calculate advanced quality metrics for automotive responses
   */
  private calculateAdvancedQuality(
    response: string,
    context: ConversationContext
  ): {
    overall: number;
    hasHallucinations: boolean;
    automotiveTermsCount: number;
    hasActionableContent: boolean;
    personalizationScore: number;
  } {
    const validators = EnhancedConversationAI.AUTOMOTIVE_QUALITY_VALIDATORS;
    const responseLC = response.toLowerCase();
    
    let score = 50; // Base score
    
    // Check for hallucinations
    const hasHallucinations = this.containsHallucinations(response);
    if (hasHallucinations) {
      score -= 20;
    }
    
    // Automotive industry terms usage
    const automotiveTermsCount = validators.industryTerms.filter(term => 
      responseLC.includes(term.toLowerCase())
    ).length;
    score += Math.min(20, automotiveTermsCount * 2);
    
    // Brand mentions (appropriate context)
    if (validators.brandMentions.test(response)) {
      score += 5;
    }
    
    // Actionable content presence
    const hasActionableContent = validators.actionableContent.test(response);
    if (hasActionableContent) {
      score += 15;
    }
    
    // Personalization score
    const personalizedElements = [
      context.leadProfile.firstName,
      context.leadProfile.vehicleInterest,
      context.leadProfile.leadSource
    ].filter(el => el && responseLC.includes(el.toLowerCase()));
    const personalizationScore = personalizedElements.length * 5;
    score += personalizationScore;
    
    // Length appropriateness
    if (response.length >= 80 && response.length <= 400) {
      score += 10;
    }
    
    // Professional tone check (no excessive punctuation or caps)
    if (!/[!]{2,}|[?]{2,}|[A-Z]{3,}/.test(response)) {
      score += 5;
    }
    
    return {
      overall: Math.min(100, Math.max(0, score)),
      hasHallucinations,
      automotiveTermsCount,
      hasActionableContent,
      personalizationScore
    };
  }

  /**
   * Check if response contains potential hallucinations
   */
  private containsHallucinations(response: string): boolean {
    const hallucinations = EnhancedConversationAI.AUTOMOTIVE_QUALITY_VALIDATORS.avoidHallucinations;
    
    // Check for specific prices without qualifiers
    if (hallucinations.specificPrices.test(response)) {
      return true;
    }
    
    // Check for specific dates without conditions
    if (hallucinations.specificDates.test(response)) {
      return true;
    }
    
    // Check for guarantees or promises
    if (hallucinations.guarantees.test(response)) {
      return true;
    }
    
    // Check for specific inventory claims
    if (hallucinations.specificInventory.test(response)) {
      return true;
    }
    
    // Check for exact time commitments
    if (hallucinations.exactTimes.test(response)) {
      return true;
    }
    
    return false;
  }

  /**
   * Sanitize response by removing or qualifying hallucinations
   */
  private sanitizeHallucinations(response: string, context: ConversationContext): string {
    const hallucinations = EnhancedConversationAI.AUTOMOTIVE_QUALITY_VALIDATORS.avoidHallucinations;
    let sanitized = response;
    
    // Replace specific prices with qualified language
    sanitized = sanitized.replace(
      hallucinations.specificPrices,
      'starting around $XXX (actual pricing may vary)'
    );
    
    // Replace specific dates with conditional language
    sanitized = sanitized.replace(
      /\b(today|tomorrow|this weekend)\b(?!\s+(?:if|when|after))/gi,
      'soon (when convenient for you)'
    );
    
    // Replace guarantees with softer language
    sanitized = sanitized.replace(
      /\b(guarantee|promise)\b/gi,
      'work to ensure'
    );
    
    // Replace specific inventory claims
    sanitized = sanitized.replace(
      hallucinations.specificInventory,
      'we can check availability of vehicles for you'
    );
    
    // Replace exact time commitments
    sanitized = sanitized.replace(
      hallucinations.exactTimes,
      'around'
    );
    
    return sanitized;
  }

  /**
   * Add automotive context and expertise to enhance response quality
   */
  private addAutomotiveContext(
    response: string,
    context: ConversationContext,
    messageAnalysis: any
  ): string {
    const validators = EnhancedConversationAI.AUTOMOTIVE_QUALITY_VALIDATORS;
    
    // If response lacks automotive terms, add relevant context
    const hasAutomotiveTerms = validators.industryTerms.some(term => 
      response.toLowerCase().includes(term.toLowerCase())
    );
    
    if (!hasAutomotiveTerms) {
      // Add relevant automotive context based on intent
      let contextualEnding = '';
      
      switch (messageAnalysis.intent) {
        case 'financing':
          contextualEnding = ' We have competitive financing options available to help make your vehicle purchase affordable.';
          break;
        case 'test_drive':
          contextualEnding = ' I can help schedule a test drive so you can experience the vehicle firsthand.';
          break;
        case 'price_inquiry':
          contextualEnding = ' Let me get you current pricing and available incentives.';
          break;
        case 'ready_to_buy':
          contextualEnding = ' I\'d be happy to help you move forward with your vehicle purchase.';
          break;
        default:
          if (context.leadProfile.vehicleInterest) {
            contextualEnding = ` I can provide more specific information about ${context.leadProfile.vehicleInterest} features and benefits.`;
          }
      }
      
      return response + contextualEnding;
    }
    
    // If response lacks actionable content, add appropriate call-to-action
    const hasActionableContent = validators.actionableContent.test(response);
    if (!hasActionableContent) {
      const ctaOptions = [
        'Would you like to schedule a call to discuss this further?',
        'I can arrange for you to speak with one of our specialists.',
        'Let me know if you\'d like to visit our showroom to see the vehicles in person.'
      ];
      
      const randomCTA = ctaOptions[Math.floor(Math.random() * ctaOptions.length)];
      return response + ' ' + randomCTA;
    }
    
    return response;
  }

  /**
   * Calculate response quality score
   */
  private async calculateResponseQuality(
    response: string,
    context: ConversationContext
  ): Promise<number> {
    // Use the advanced quality calculation if validation is enabled
    if (EnhancedConversationAI.ENABLE_QUALITY_VALIDATION) {
      const metrics = this.calculateAdvancedQuality(response, context);
      return metrics.overall;
    }
    
    // Fallback to original quality calculation
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