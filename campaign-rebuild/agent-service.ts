/**
 * Agent Service - AI Response Generation
 * Handles agent configuration and intelligent responses
 */

import { Agent, Conversation, Message } from './schema';

interface GenerateResponseParams {
  agent: Agent;
  conversation: Conversation;
  messages: Message[];
  leadMessage: string;
}

interface AIResponse {
  content: string;
  confidence: number;
  shouldHandover: boolean;
  handoverReason?: string;
}

export class AgentService {
  private openRouterApiKey: string;
  private defaultModel: string;

  constructor(config: {
    openRouterApiKey: string;
    defaultModel?: string;
  }) {
    this.openRouterApiKey = config.openRouterApiKey;
    this.defaultModel = config.defaultModel || 'openai/gpt-4-turbo-preview';
  }

  /**
   * Build the system prompt from agent configuration
   */
  private buildSystemPrompt(agent: Agent): string {
    let prompt = agent.systemPrompt;
    
    // Replace placeholders with actual values
    if (agent.promptVariables && typeof agent.promptVariables === 'object') {
      const variables = agent.promptVariables as Record<string, string>;
      
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{${key}}`;
        prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
      });
    }
    
    // Add handover instructions if triggers are defined
    if (agent.handoverTriggers && agent.handoverTriggers.length > 0) {
      prompt += `\n\n## Handover Triggers
If the customer mentions any of these topics, politely indicate that you'll connect them with a specialist:
${agent.handoverTriggers.map(trigger => `- ${trigger}`).join('\n')}

When a handover is needed, end your response with: [HANDOVER_NEEDED]`;
    }
    
    // Add message limit warning
    if (agent.maxMessages) {
      prompt += `\n\nNote: You are limited to ${agent.maxMessages} exchanges. After ${agent.maxMessages - 2} messages, start guiding the conversation toward a concrete next step.`;
    }
    
    return prompt;
  }

  /**
   * Build conversation context from message history
   */
  private buildConversationContext(messages: Message[]): string {
    if (messages.length === 0) {
      return "This is the first message in the conversation.";
    }
    
    // Take last 5 messages for context
    const recentMessages = messages.slice(-5);
    
    const context = recentMessages
      .map(msg => {
        const sender = msg.senderType === 'agent' ? 'Assistant' : 'Customer';
        return `${sender}: ${msg.content}`;
      })
      .join('\n\n');
    
    return `Previous conversation:\n${context}`;
  }

  /**
   * Check if message contains handover triggers
   */
  private checkHandoverTriggers(
    message: string, 
    triggers: string[]
  ): { triggered: boolean; reason?: string } {
    const lowerMessage = message.toLowerCase();
    
    for (const trigger of triggers) {
      if (lowerMessage.includes(trigger.toLowerCase())) {
        return {
          triggered: true,
          reason: `Customer mentioned: "${trigger}"`,
        };
      }
    }
    
    return { triggered: false };
  }

  /**
   * Generate AI response for a lead message
   */
  async generateResponse(params: GenerateResponseParams): Promise<AIResponse> {
    const { agent, conversation, messages, leadMessage } = params;
    
    // Check for handover triggers first
    if (agent.handoverTriggers) {
      const triggerCheck = this.checkHandoverTriggers(leadMessage, agent.handoverTriggers);
      if (triggerCheck.triggered) {
        return {
          content: "I'd be happy to connect you with one of our specialists who can better assist you with that. They'll be in touch with you shortly.",
          confidence: 1.0,
          shouldHandover: true,
          handoverReason: triggerCheck.reason,
        };
      }
    }
    
    // Check message count limit
    if (agent.maxMessages && conversation.aiMessageCount >= agent.maxMessages) {
      return {
        content: "I've enjoyed our conversation! To provide you with the best service, I'd like to connect you with one of our specialists who can help you with the next steps. They'll be reaching out to you soon.",
        confidence: 1.0,
        shouldHandover: true,
        handoverReason: `Reached maximum message limit (${agent.maxMessages})`,
      };
    }
    
    try {
      const systemPrompt = this.buildSystemPrompt(agent);
      const conversationContext = this.buildConversationContext(messages);
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'MailMind Campaign System',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `${conversationContext}\n\nCustomer: ${leadMessage}\n\nProvide a helpful, concise response (2-3 sentences max). If a handover is needed based on the system instructions, end with [HANDOVER_NEEDED].`,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || '';
      
      // Check if response indicates handover is needed
      const handoverNeeded = aiResponse.includes('[HANDOVER_NEEDED]');
      const cleanedResponse = aiResponse.replace('[HANDOVER_NEEDED]', '').trim();
      
      // Calculate confidence based on response
      const confidence = this.calculateConfidence(cleanedResponse);
      
      // Check if confidence is below threshold
      const lowConfidence = agent.confidenceThreshold && 
                           confidence < parseFloat(agent.confidenceThreshold.toString());
      
      return {
        content: cleanedResponse,
        confidence,
        shouldHandover: handoverNeeded || lowConfidence,
        handoverReason: handoverNeeded 
          ? 'AI determined handover needed' 
          : lowConfidence 
            ? `Low confidence (${confidence.toFixed(2)} < ${agent.confidenceThreshold})` 
            : undefined,
      };
    } catch (error) {
      console.error('AI response generation error:', error);
      
      // Return a safe fallback response
      return {
        content: "Thank you for your message. I'll make sure one of our team members follows up with you shortly.",
        confidence: 0,
        shouldHandover: true,
        handoverReason: 'AI service error',
      };
    }
  }

  /**
   * Calculate confidence score for a response
   */
  private calculateConfidence(response: string): number {
    // Simple heuristic-based confidence calculation
    let confidence = 0.8; // Base confidence
    
    // Reduce confidence for very short responses
    if (response.length < 20) confidence -= 0.2;
    
    // Reduce confidence for responses with uncertainty markers
    const uncertaintyMarkers = [
      'i think', 'maybe', 'possibly', 'might', 'could be',
      'not sure', 'i believe', 'perhaps', 'probably',
    ];
    
    const lowerResponse = response.toLowerCase();
    for (const marker of uncertaintyMarkers) {
      if (lowerResponse.includes(marker)) {
        confidence -= 0.1;
      }
    }
    
    // Reduce confidence for questions without statements
    const questionCount = (response.match(/\?/g) || []).length;
    const statementCount = (response.match(/\./g) || []).length;
    if (questionCount > statementCount) confidence -= 0.1;
    
    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Generate a handover summary for human agents
   */
  async generateHandoverSummary(
    conversation: Conversation,
    messages: Message[]
  ): Promise<string> {
    if (messages.length === 0) {
      return "New conversation with no messages yet.";
    }
    
    try {
      const conversationText = messages
        .map(msg => `${msg.senderType === 'agent' ? 'Agent' : 'Customer'}: ${msg.content}`)
        .join('\n');
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'MailMind Campaign System',
        },
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes conversations for human agents. Provide a brief, clear summary highlighting key points and customer needs.',
            },
            {
              role: 'user',
              content: `Summarize this conversation for a human agent who needs to take over:\n\n${conversationText}\n\nProvide a 2-3 sentence summary focusing on: 1) What the customer wants, 2) Key information discussed, 3) Suggested next steps.`,
            },
          ],
          temperature: 0.3,
          max_tokens: 150,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Conversation requires human attention.";
      }
    } catch (error) {
      console.error('Summary generation error:', error);
    }
    
    // Fallback summary
    const lastCustomerMessage = messages
      .filter(m => m.senderType === 'lead')
      .slice(-1)[0];
    
    return lastCustomerMessage 
      ? `Customer's last message: "${lastCustomerMessage.content.substring(0, 100)}..."`
      : "Conversation requires human attention.";
  }
}
