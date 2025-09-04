import { z } from 'zod';
import { 
  OfferLogixConversationSchema, 
  type OfferLogixConversation,
  getOfferLogixConversationSchemaPrompt,
  parseAndValidate
} from './prompt-schemas';

/**
 * OfferLogix Financing Conversation Service
 * Manages intelligent conversations for automotive financing
 */

export interface ConversationContext {
  sessionId: string;
  customerId: string;
  stage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  customerProfile?: {
    creditTier?: string;
    vehicleInterest?: string;
    budget?: number;
    timeline?: string;
  };
  metadata?: Record<string, any>;
}

export class OfferLogixConversationService {
  private contexts: Map<string, ConversationContext> = new Map();

  /**
   * Process customer message and generate response
   */
  async processMessage(
    sessionId: string,
    message: string,
    openaiClient: any
  ): Promise<OfferLogixConversation> {
    const context = this.getOrCreateContext(sessionId);
    
    // Add user message to history
    context.history.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    const prompt = this.buildConversationPrompt(message, context);
    
    try {
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an OfferLogix financing specialist helping customers with auto financing.
            Current stage: ${context.stage}
            ${getOfferLogixConversationSchemaPrompt()}`
          },
          ...this.formatHistory(context),
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = parseAndValidate(content, OfferLogixConversationSchema, 'OfferLogixConversation');
      
      // Update context
      context.stage = result.stage;
      context.history.push({
        role: 'assistant',
        content: result.message,
        timestamp: new Date()
      });
      
      this.contexts.set(sessionId, context);
      
      return result;
    } catch (error) {
      console.error('Conversation error:', error);
      return this.getFallbackResponse(message, context);
    }
  }

  /**
   * Build conversation prompt with context
   */
  private buildConversationPrompt(message: string, context: ConversationContext): string {
    const profile = context.customerProfile;
    
    return `Customer message: "${message}"

${profile ? `Customer Profile:
- Credit Tier: ${profile.creditTier || 'Unknown'}
- Vehicle Interest: ${profile.vehicleInterest || 'Not specified'}
- Budget: ${profile.budget ? `$${profile.budget.toLocaleString()}` : 'Not specified'}
- Timeline: ${profile.timeline || 'Not specified'}` : ''}

Conversation Stage: ${context.stage}
Message Count: ${context.history.length}

Provide appropriate response based on stage and customer needs. Detect intent and sentiment.`;
  }

  /**
   * Format conversation history for API
   */
  private formatHistory(context: ConversationContext): Array<{role: string; content: string}> {
    // Only include last 5 exchanges to stay within context limits
    const recent = context.history.slice(-10);
    
    return recent.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Get or create conversation context
   */
  private getOrCreateContext(sessionId: string): ConversationContext {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, {
        sessionId,
        customerId: `customer-${Date.now()}`,
        stage: 'greeting',
        history: [],
        customerProfile: {}
      });
    }
    
    return this.contexts.get(sessionId)!;
  }

  /**
   * Fallback response when API fails
   */
  private getFallbackResponse(message: string, context: ConversationContext): OfferLogixConversation {
    const lowerMessage = message.toLowerCase();
    
    // Detect basic intents
    let intent: OfferLogixConversation['intent'] = 'information_seeking';
    if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
      intent = 'price_inquiry';
    } else if (lowerMessage.includes('finance') || lowerMessage.includes('loan')) {
      intent = 'financing_inquiry';
    } else if (lowerMessage.includes('test') || lowerMessage.includes('drive')) {
      intent = 'test_drive_request';
    }
    
    // Generate stage-appropriate response
    let response: string;
    let suggestedActions: string[] = [];
    
    switch (context.stage) {
      case 'greeting':
        response = "Welcome to OfferLogix! I'm here to help you get instant financing approval. What type of vehicle are you interested in?";
        suggestedActions = ['Browse inventory', 'Get pre-qualified', 'Calculate payments'];
        break;
        
      case 'qualification':
        response = "I can help you get pre-qualified in just 60 seconds. Would you like to start with a soft credit check that won't affect your score?";
        suggestedActions = ['Start pre-qualification', 'Learn about credit tiers'];
        break;
        
      default:
        response = "I understand you're interested in financing. Let me help you with that. Could you tell me more about what you're looking for?";
        suggestedActions = ['Check rates', 'Calculate payments', 'Speak to specialist'];
    }
    
    return {
      message: response,
      stage: context.stage as any,
      intent,
      sentiment: 'neutral',
      suggestedActions,
      escalationNeeded: false,
      complianceFlags: []
    };
  }

  /**
   * Update customer profile based on conversation
   */
  updateCustomerProfile(
    sessionId: string, 
    updates: Partial<ConversationContext['customerProfile']>
  ): void {
    const context = this.getOrCreateContext(sessionId);
    context.customerProfile = {
      ...context.customerProfile,
      ...updates
    };
    this.contexts.set(sessionId, context);
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(sessionId: string): {
    messageCount: number;
    currentStage: string;
    duration: number;
    keyTopics: string[];
  } | null {
    const context = this.contexts.get(sessionId);
    if (!context || context.history.length === 0) return null;
    
    const firstMessage = context.history[0].timestamp;
    const lastMessage = context.history[context.history.length - 1].timestamp;
    const duration = Math.round((lastMessage.getTime() - firstMessage.getTime()) / 1000 / 60);
    
    // Extract key topics from conversation
    const allMessages = context.history.map(h => h.content).join(' ').toLowerCase();
    const keyTopics: string[] = [];
    
    if (allMessages.includes('credit')) keyTopics.push('Credit inquiry');
    if (allMessages.includes('payment')) keyTopics.push('Payment calculation');
    if (allMessages.includes('trade')) keyTopics.push('Trade-in');
    if (allMessages.includes('test')) keyTopics.push('Test drive');
    
    return {
      messageCount: context.history.length,
      currentStage: context.stage,
      duration,
      keyTopics
    };
  }

  /**
   * Clear conversation context
   */
  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }
}