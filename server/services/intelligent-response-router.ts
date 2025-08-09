import { enhancedConversationAI, type ConversationContext, type ResponseGenerationOptions } from './enhanced-conversation-ai';
import { dynamicResponseIntelligenceService, type ConversationAnalysis } from './dynamic-response-intelligence';
import { leadScoringService } from './lead-scoring';
import { storage } from '../storage';
import type { Conversation, ConversationMessage, Lead } from '@shared/schema';

/**
 * Intelligent Response Router Service
 * 
 * Routes conversations to appropriate response mechanisms based on context,
 * intent analysis, and conversation state. Manages escalation to human agents
 * when needed and maintains conversation continuity.
 * 
 * Features:
 * - Context-aware routing decisions
 * - Template vs AI generation routing
 * - Escalation management
 * - Response effectiveness tracking
 * - Multi-turn conversation flow management
 */

export interface RoutingDecision {
  routingType: 'ai_generated' | 'template_based' | 'human_escalation' | 'automated_action';
  confidence: number;
  reasoning: string;
  suggestedTemplate?: string;
  escalationReason?: string;
  requiredActions?: string[];
  priority: 'immediate' | 'urgent' | 'normal' | 'low';
}

export interface ResponseTemplate {
  id: string;
  name: string;
  category: 'greeting' | 'information' | 'pricing' | 'scheduling' | 'followup' | 'objection_handling';
  content: string;
  placeholders: string[];
  useConditions: string[];
  effectiveness: number; // 0-100 score
  automotiveFocus: string[]; // vehicle types this template works best for
}

export interface EscalationTrigger {
  type: 'buying_signal' | 'complaint' | 'complex_request' | 'high_value' | 'urgent_timeline' | 'competitor_mention';
  threshold: number;
  action: 'immediate' | 'scheduled' | 'queue';
  notificationRequired: boolean;
  priority: number;
}

export interface ConversationFlowState {
  conversationId: string;
  currentStage: 'introduction' | 'information_gathering' | 'needs_assessment' | 'presentation' | 'objection_handling' | 'closing' | 'post_sale';
  completedActions: string[];
  nextRecommendedActions: string[];
  flowProgress: number; // 0-100
  stageStartTime: Date;
  expectedCompletion?: Date;
}

export interface RoutingMetrics {
  totalDecisions: number;
  aiGeneratedResponses: number;
  templateBasedResponses: number;
  humanEscalations: number;
  averageResponseTime: number;
  effectivenessScore: number;
  conversionImpact: number;
}

export class IntelligentResponseRouter {
  private responseTemplates: Map<string, ResponseTemplate>;
  private escalationTriggers: EscalationTrigger[];
  private conversationFlows: Map<string, ConversationFlowState>;
  private routingMetrics: RoutingMetrics;

  constructor() {
    this.responseTemplates = new Map();
    this.escalationTriggers = this.initializeEscalationTriggers();
    this.conversationFlows = new Map();
    this.routingMetrics = this.initializeMetrics();
    this.initializeResponseTemplates();
  }

  /**
   * Main routing decision engine - determines how to respond to a conversation
   */
  async routeConversation(
    conversationId: string,
    newMessage: string,
    senderId: string
  ): Promise<{
    routingDecision: RoutingDecision;
    suggestedResponse?: string;
    templateData?: any;
    escalationData?: any;
    nextSteps: string[];
  }> {
    // Build conversation context
    const context = await this.buildConversationContext(conversationId);
    
    // Analyze the routing requirements
    const routingDecision = await this.makeRoutingDecision(context, newMessage);
    
    // Update conversation flow state
    await this.updateConversationFlow(conversationId, routingDecision, newMessage);
    
    // Generate response based on routing decision
    const responseData = await this.executeRoutingDecision(
      routingDecision, 
      context, 
      newMessage
    );
    
    // Track metrics
    this.updateRoutingMetrics(routingDecision);
    
    return {
      routingDecision,
      ...responseData,
      nextSteps: this.generateNextSteps(routingDecision, context)
    };
  }

  /**
   * Build comprehensive conversation context for routing decisions
   */
  private async buildConversationContext(conversationId: string): Promise<ConversationContext> {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const leadProfile = await storage.getLead(conversation.leadId);
    if (!leadProfile) {
      throw new Error(`Lead ${conversation.leadId} not found`);
    }

    const conversationHistory = await storage.getConversationMessages(conversationId);
    const currentAnalysis = await dynamicResponseIntelligenceService.analyzeConversation(conversationId);
    const leadScoreResult = await leadScoringService.calculateLeadScore(conversation.leadId);
    
    // Get previous AI responses for context
    const previousResponses = conversationHistory
      .filter(m => m.isFromAI)
      .map(m => m.content)
      .slice(-3); // Last 3 AI responses

    return {
      leadId: conversation.leadId,
      conversationId,
      leadProfile,
      conversationHistory,
      currentAnalysis,
      leadScore: leadScoreResult.totalScore,
      priority: leadScoreResult.priority,
      previousResponses
    };
  }

  /**
   * Core routing decision logic
   */
  private async makeRoutingDecision(
    context: ConversationContext,
    newMessage: string
  ): Promise<RoutingDecision> {
    const { currentAnalysis, leadScore, priority } = context;
    
    // Check escalation triggers first
    const escalationCheck = this.checkEscalationTriggers(context, newMessage);
    if (escalationCheck.shouldEscalate) {
      return {
        routingType: 'human_escalation',
        confidence: escalationCheck.confidence,
        reasoning: escalationCheck.reason,
        escalationReason: escalationCheck.reason,
        priority: this.determinePriority(currentAnalysis, priority)
      };
    }

    // Check for automated actions (scheduling, information requests)
    const automatedAction = this.checkAutomatedActions(newMessage, context);
    if (automatedAction.applicable) {
      return {
        routingType: 'automated_action',
        confidence: automatedAction.confidence,
        reasoning: automatedAction.reasoning,
        requiredActions: automatedAction.actions,
        priority: 'normal'
      };
    }

    // Check for suitable templates
    const templateMatch = this.findBestTemplate(context, newMessage);
    if (templateMatch.score > 70) {
      return {
        routingType: 'template_based',
        confidence: templateMatch.score,
        reasoning: `High-confidence template match: ${templateMatch.template.name}`,
        suggestedTemplate: templateMatch.template.id,
        priority: 'normal'
      };
    }

    // Default to AI generation
    return {
      routingType: 'ai_generated',
      confidence: this.calculateAIConfidence(context, newMessage),
      reasoning: 'No suitable template found, using AI generation for personalized response',
      priority: this.determinePriority(currentAnalysis, priority)
    };
  }

  /**
   * Check if conversation should be escalated to human agent
   */
  private checkEscalationTriggers(
    context: ConversationContext, 
    newMessage: string
  ): { shouldEscalate: boolean; confidence: number; reason: string } {
    const messageLC = newMessage.toLowerCase();
    
    // Check against each escalation trigger
    for (const trigger of this.escalationTriggers) {
      let score = 0;
      
      switch (trigger.type) {
        case 'buying_signal':
          const buyingSignals = ['ready to buy', 'sign today', 'cash buyer', 'pre-approved', 'make a deal'];
          if (buyingSignals.some(signal => messageLC.includes(signal))) {
            score = 95;
          }
          break;
          
        case 'complaint':
          const complaintWords = ['complaint', 'unhappy', 'disappointed', 'terrible', 'awful', 'manager'];
          if (complaintWords.some(word => messageLC.includes(word))) {
            score = 90;
          }
          break;
          
        case 'complex_request':
          if (newMessage.length > 300 || (newMessage.match(/\?/g) || []).length >= 3) {
            score = 75;
          }
          break;
          
        case 'high_value':
          if (context.priority === 'hot' && context.leadScore >= 80) {
            score = 85;
          }
          break;
          
        case 'urgent_timeline':
          const urgentWords = ['today', 'asap', 'urgent', 'immediately', 'this week'];
          if (urgentWords.some(word => messageLC.includes(word))) {
            score = 80;
          }
          break;
          
        case 'competitor_mention':
          const competitors = ['toyota', 'honda', 'ford', 'chevy', 'nissan', 'other dealer'];
          if (competitors.some(comp => messageLC.includes(comp))) {
            score = 70;
          }
          break;
      }
      
      if (score >= trigger.threshold) {
        return {
          shouldEscalate: true,
          confidence: score,
          reason: `${trigger.type.replace('_', ' ')} detected - ${trigger.action} escalation required`
        };
      }
    }
    
    return { shouldEscalate: false, confidence: 0, reason: '' };
  }

  /**
   * Check for automated actions that can be handled without AI/human intervention
   */
  private checkAutomatedActions(
    message: string, 
    context: ConversationContext
  ): { applicable: boolean; confidence: number; reasoning: string; actions: string[] } {
    const messageLC = message.toLowerCase();
    const actions: string[] = [];
    
    // Hours/availability requests
    if (messageLC.includes('hours') || messageLC.includes('open')) {
      actions.push('send_hours_info');
    }
    
    // Location/directions requests
    if (messageLC.includes('location') || messageLC.includes('address') || messageLC.includes('directions')) {
      actions.push('send_location_info');
    }
    
    // Simple yes/no responses to previous questions
    if (['yes', 'no', 'ok', 'sure', 'sounds good'].includes(messageLC.trim())) {
      actions.push('acknowledge_response');
    }
    
    if (actions.length > 0) {
      return {
        applicable: true,
        confidence: 85,
        reasoning: 'Simple informational request that can be handled automatically',
        actions
      };
    }
    
    return { applicable: false, confidence: 0, reasoning: '', actions: [] };
  }

  /**
   * Find the best matching response template
   */
  private findBestTemplate(
    context: ConversationContext,
    message: string
  ): { template: ResponseTemplate; score: number } {
    let bestTemplate: ResponseTemplate | null = null;
    let bestScore = 0;
    
    for (const template of Array.from(this.responseTemplates.values())) {
      const score = this.calculateTemplateMatch(template, context, message);
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }
    
    return {
      template: bestTemplate || this.getDefaultTemplate(),
      score: bestScore
    };
  }

  /**
   * Calculate how well a template matches the current context
   */
  private calculateTemplateMatch(
    template: ResponseTemplate,
    context: ConversationContext,
    message: string
  ): number {
    let score = 0;
    const messageLC = message.toLowerCase();
    
    // Check use conditions
    for (const condition of template.useConditions) {
      if (messageLC.includes(condition.toLowerCase())) {
        score += 25;
      }
    }
    
    // Automotive focus alignment
    const vehicleInterest = context.leadProfile.vehicleInterest?.toLowerCase() || '';
    if (template.automotiveFocus.some(focus => vehicleInterest.includes(focus))) {
      score += 20;
    }
    
    // Category relevance
    const categoryRelevance = this.getCategoryRelevance(template.category, context.currentAnalysis.intent);
    score += categoryRelevance;
    
    // Template effectiveness
    score += (template.effectiveness * 0.3);
    
    return Math.min(100, score);
  }

  /**
   * Get category relevance score based on conversation intent
   */
  private getCategoryRelevance(category: string, intent: string): number {
    const relevanceMap: Record<string, Record<string, number>> = {
      'greeting': { 'research': 15, 'comparison': 10, 'ready_to_buy': 5 },
      'information': { 'research': 30, 'comparison': 25, 'undecided': 20 },
      'pricing': { 'price_focused': 35, 'comparison': 30, 'ready_to_buy': 25 },
      'scheduling': { 'ready_to_buy': 35, 'research': 15, 'comparison': 20 },
      'followup': { 'research': 20, 'undecided': 25, 'comparison': 15 },
      'objection_handling': { 'price_focused': 30, 'comparison': 35, 'undecided': 25 }
    };
    
    return relevanceMap[category]?.[intent] || 10;
  }

  /**
   * Execute the routing decision and generate appropriate response
   */
  private async executeRoutingDecision(
    decision: RoutingDecision,
    context: ConversationContext,
    message: string
  ): Promise<{
    suggestedResponse?: string;
    templateData?: any;
    escalationData?: any;
  }> {
    switch (decision.routingType) {
      case 'ai_generated':
        return await this.generateAIResponse(context, message, decision);
        
      case 'template_based':
        return await this.generateTemplateResponse(context, decision.suggestedTemplate!);
        
      case 'human_escalation':
        return await this.createEscalationData(context, decision);
        
      case 'automated_action':
        return await this.executeAutomatedActions(context, decision.requiredActions!);
        
      default:
        throw new Error(`Unknown routing type: ${decision.routingType}`);
    }
  }

  /**
   * Generate AI response using the enhanced conversation AI
   */
  private async generateAIResponse(
    context: ConversationContext,
    message: string,
    decision: RoutingDecision
  ): Promise<{ suggestedResponse: string }> {
    const options: ResponseGenerationOptions = {
      responseType: this.determineResponseType(context.currentAnalysis.intent),
      urgency: context.currentAnalysis.urgency,
      includeVehicleDetails: context.leadProfile.vehicleInterest !== null,
      includeFinancingOptions: context.currentAnalysis.intent === 'price_focused',
      includeIncentives: context.priority === 'hot',
      tone: this.determineTone(context.currentAnalysis.mood),
      maxResponseLength: 300,
      personalizationLevel: context.priority === 'hot' ? 'high' : 'moderate'
    };
    
    const response = await enhancedConversationAI.generateContextAwareResponse(
      context,
      message,
      options
    );
    
    return { suggestedResponse: response.content };
  }

  /**
   * Generate response from template with personalization
   */
  private async generateTemplateResponse(
    context: ConversationContext,
    templateId: string
  ): Promise<{ suggestedResponse: string; templateData: any }> {
    const template = this.responseTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    // Replace placeholders with actual data
    let response = template.content;
    const replacements = this.buildTemplateReplacements(context);
    
    for (const [placeholder, value] of Object.entries(replacements)) {
      response = response.replace(new RegExp(`\\[${placeholder}\\]`, 'g'), value);
    }
    
    return {
      suggestedResponse: response,
      templateData: { templateId, replacements }
    };
  }

  /**
   * Create escalation data for human agent handoff
   */
  private async createEscalationData(
    context: ConversationContext,
    decision: RoutingDecision
  ): Promise<{ escalationData: any }> {
    const escalationData = {
      reason: decision.escalationReason,
      priority: decision.priority,
      leadProfile: context.leadProfile,
      conversationSummary: this.generateConversationSummary(context),
      suggestedActions: this.generateEscalationActions(context, decision),
      urgencyLevel: context.currentAnalysis.urgency,
      buyingSignals: context.currentAnalysis.buyingSignals,
      leadScore: context.leadScore,
      estimatedValue: this.estimateLeadValue(context)
    };
    
    return { escalationData };
  }

  /**
   * Execute automated actions
   */
  private async executeAutomatedActions(
    context: ConversationContext,
    actions: string[]
  ): Promise<{ suggestedResponse: string }> {
    const responses: string[] = [];
    
    for (const action of actions) {
      switch (action) {
        case 'send_hours_info':
          responses.push("Our showroom is open Monday-Saturday 9AM-8PM, Sunday 12PM-6PM. Service department is open Monday-Friday 7AM-6PM, Saturday 8AM-4PM.");
          break;
          
        case 'send_location_info':
          responses.push("We're located at [DEALERSHIP_ADDRESS]. You can find directions on our website or call us at [PHONE_NUMBER] for assistance.");
          break;
          
        case 'acknowledge_response':
          responses.push(`Great! I'll make note of that. Is there anything else about ${context.leadProfile.vehicleInterest || 'our vehicles'} I can help you with?`);
          break;
      }
    }
    
    return { suggestedResponse: responses.join(' ') };
  }

  /**
   * Update conversation flow state
   */
  private async updateConversationFlow(
    conversationId: string,
    decision: RoutingDecision,
    message: string
  ): Promise<void> {
    let flowState = this.conversationFlows.get(conversationId);
    
    if (!flowState) {
      flowState = {
        conversationId,
        currentStage: 'introduction',
        completedActions: [],
        nextRecommendedActions: [],
        flowProgress: 0,
        stageStartTime: new Date()
      };
    }
    
    // Update flow based on routing decision and message content
    this.advanceConversationStage(flowState, decision, message);
    
    this.conversationFlows.set(conversationId, flowState);
  }

  /**
   * Initialize response templates
   */
  private initializeResponseTemplates(): void {
    const templates: ResponseTemplate[] = [
      {
        id: 'greeting_new_lead',
        name: 'New Lead Greeting',
        category: 'greeting',
        content: 'Hi [CUSTOMER_NAME]! Thanks for your interest in [VEHICLE_INTEREST]. I\'m here to help answer any questions you have. What would you like to know?',
        placeholders: ['CUSTOMER_NAME', 'VEHICLE_INTEREST'],
        useConditions: ['first message', 'introduction', 'hello'],
        effectiveness: 85,
        automotiveFocus: ['all']
      },
      {
        id: 'pricing_info',
        name: 'Pricing Information Response',
        category: 'pricing',
        content: 'Great question about pricing for the [VEHICLE_INTEREST]! We have competitive pricing starting at [STARTING_PRICE]. I\'d love to show you our current incentives and financing options. When would be a good time to discuss this in detail?',
        placeholders: ['VEHICLE_INTEREST', 'STARTING_PRICE'],
        useConditions: ['price', 'cost', 'how much'],
        effectiveness: 80,
        automotiveFocus: ['sedan', 'suv', 'truck']
      },
      {
        id: 'test_drive_scheduling',
        name: 'Test Drive Scheduling',
        category: 'scheduling',
        content: 'Perfect! I\'d be happy to schedule a test drive of the [VEHICLE_INTEREST] for you. We have availability [AVAILABILITY_OPTIONS]. Which time works best for your schedule?',
        placeholders: ['VEHICLE_INTEREST', 'AVAILABILITY_OPTIONS'],
        useConditions: ['test drive', 'schedule', 'appointment'],
        effectiveness: 90,
        automotiveFocus: ['all']
      },
      {
        id: 'financing_options',
        name: 'Financing Information',
        category: 'information',
        content: 'We offer excellent financing options for the [VEHICLE_INTEREST]! Our current rates start as low as [APR_RATE]% APR with qualified credit. We also have lease options with payments as low as [LEASE_PAYMENT]/month. Would you like to see what you qualify for?',
        placeholders: ['VEHICLE_INTEREST', 'APR_RATE', 'LEASE_PAYMENT'],
        useConditions: ['financing', 'loan', 'payment', 'lease'],
        effectiveness: 88,
        automotiveFocus: ['all']
      }
    ];
    
    templates.forEach(template => {
      this.responseTemplates.set(template.id, template);
    });
  }

  /**
   * Initialize escalation triggers
   */
  private initializeEscalationTriggers(): EscalationTrigger[] {
    return [
      {
        type: 'buying_signal',
        threshold: 80,
        action: 'immediate',
        notificationRequired: true,
        priority: 10
      },
      {
        type: 'complaint',
        threshold: 75,
        action: 'immediate',
        notificationRequired: true,
        priority: 9
      },
      {
        type: 'high_value',
        threshold: 85,
        action: 'immediate',
        notificationRequired: true,
        priority: 8
      },
      {
        type: 'urgent_timeline',
        threshold: 70,
        action: 'scheduled',
        notificationRequired: true,
        priority: 7
      },
      {
        type: 'complex_request',
        threshold: 65,
        action: 'queue',
        notificationRequired: false,
        priority: 5
      },
      {
        type: 'competitor_mention',
        threshold: 60,
        action: 'scheduled',
        notificationRequired: false,
        priority: 6
      }
    ];
  }

  /**
   * Helper methods for routing decisions
   */
  private determinePriority(
    analysis: ConversationAnalysis,
    leadPriority: string
  ): RoutingDecision['priority'] {
    if (analysis.urgency === 'critical' || leadPriority === 'hot') return 'immediate';
    if (analysis.urgency === 'high' || leadPriority === 'warm') return 'urgent';
    return 'normal';
  }

  private determineResponseType(intent: string): ResponseGenerationOptions['responseType'] {
    const intentMap: Record<string, ResponseGenerationOptions['responseType']> = {
      'ready_to_buy': 'sales_focused',
      'price_focused': 'sales_focused',
      'research': 'informational',
      'comparison': 'informational',
      'undecided': 'followup'
    };
    return intentMap[intent] || 'informational';
  }

  private determineTone(mood: string): ResponseGenerationOptions['tone'] {
    const moodMap: Record<string, ResponseGenerationOptions['tone']> = {
      'excited': 'enthusiastic',
      'positive': 'friendly',
      'neutral': 'professional',
      'frustrated': 'professional',
      'negative': 'professional'
    };
    return moodMap[mood] || 'professional';
  }

  private calculateAIConfidence(context: ConversationContext, message: string): number {
    let confidence = 70;
    
    if (context.priority === 'hot') confidence += 10;
    if (context.conversationHistory.length > 3) confidence += 5;
    if (message.length > 50 && message.length < 300) confidence += 5;
    
    return Math.min(95, confidence);
  }

  private buildTemplateReplacements(context: ConversationContext): Record<string, string> {
    return {
      'CUSTOMER_NAME': context.leadProfile.firstName || 'there',
      'VEHICLE_INTEREST': context.leadProfile.vehicleInterest || 'our vehicles',
      'STARTING_PRICE': '$25,000', // Would come from vehicle database
      'APR_RATE': '3.9', // Would come from current rates
      'LEASE_PAYMENT': '$299', // Would come from current offers
      'AVAILABILITY_OPTIONS': 'today, tomorrow, or this weekend',
      'DEALERSHIP_ADDRESS': '123 Main St, Your City, ST 12345',
      'PHONE_NUMBER': '(555) 123-4567'
    };
  }

  private generateConversationSummary(context: ConversationContext): string {
    const messages = context.conversationHistory.slice(-5);
    return messages.map(m => 
      `${m.isFromAI ? 'Agent' : 'Customer'}: ${m.content.substring(0, 100)}...`
    ).join('\n');
  }

  private generateEscalationActions(context: ConversationContext, decision: RoutingDecision): string[] {
    const actions = ['Review conversation history', 'Contact customer within 30 minutes'];
    
    if (context.currentAnalysis.intent === 'ready_to_buy') {
      actions.push('Prepare financing pre-approval');
      actions.push('Check vehicle availability');
    }
    
    if (decision.escalationReason?.includes('complaint')) {
      actions.push('Escalate to manager');
      actions.push('Document complaint details');
    }
    
    return actions;
  }

  private estimateLeadValue(context: ConversationContext): number {
    let baseValue = 25000; // Average vehicle price
    
    if (context.leadProfile.vehicleInterest?.toLowerCase().includes('truck')) baseValue = 35000;
    if (context.leadProfile.vehicleInterest?.toLowerCase().includes('luxury')) baseValue = 45000;
    if (context.priority === 'hot') baseValue *= 1.2;
    
    return Math.round(baseValue);
  }

  private generateNextSteps(decision: RoutingDecision, context: ConversationContext): string[] {
    const steps = [];
    
    if (decision.routingType === 'human_escalation') {
      steps.push('Notify human agent immediately');
      steps.push('Prepare handoff documentation');
    } else if (decision.routingType === 'ai_generated') {
      steps.push('Monitor response effectiveness');
      steps.push('Track conversation progression');
    }
    
    return steps;
  }

  private advanceConversationStage(
    flowState: ConversationFlowState,
    decision: RoutingDecision,
    message: string
  ): void {
    // Logic to advance conversation stages based on content and decisions
    // This would implement a state machine for conversation flow
  }

  private getDefaultTemplate(): ResponseTemplate {
    return {
      id: 'default',
      name: 'Default Response',
      category: 'information',
      content: 'Thank you for your message. Let me get that information for you.',
      placeholders: [],
      useConditions: [],
      effectiveness: 50,
      automotiveFocus: ['all']
    };
  }

  private initializeMetrics(): RoutingMetrics {
    return {
      totalDecisions: 0,
      aiGeneratedResponses: 0,
      templateBasedResponses: 0,
      humanEscalations: 0,
      averageResponseTime: 0,
      effectivenessScore: 0,
      conversionImpact: 0
    };
  }

  private updateRoutingMetrics(decision: RoutingDecision): void {
    this.routingMetrics.totalDecisions++;
    
    switch (decision.routingType) {
      case 'ai_generated':
        this.routingMetrics.aiGeneratedResponses++;
        break;
      case 'template_based':
        this.routingMetrics.templateBasedResponses++;
        break;
      case 'human_escalation':
        this.routingMetrics.humanEscalations++;
        break;
    }
  }

  /**
   * Get routing performance metrics
   */
  getRoutingMetrics(): RoutingMetrics {
    return { ...this.routingMetrics };
  }

  /**
   * Get conversation flow state
   */
  getConversationFlow(conversationId: string): ConversationFlowState | undefined {
    return this.conversationFlows.get(conversationId);
  }

  /**
   * Update template effectiveness based on results
   */
  async updateTemplateEffectiveness(templateId: string, effectiveness: number): Promise<void> {
    const template = this.responseTemplates.get(templateId);
    if (template) {
      template.effectiveness = effectiveness;
      this.responseTemplates.set(templateId, template);
    }
  }
}

export const intelligentResponseRouter = new IntelligentResponseRouter();