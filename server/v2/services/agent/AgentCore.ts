/**
 * AgentCore Service for OfferLogix V2
 * 
 * Handles LLM generation with prompt building and response parsing.
 * Returns structured {reply, handover, reason} responses.
 */

export interface LLMResponse {
  reply: string;
  handover: boolean;
  reason?: string;
}

interface OpenRouterResponse {
  reply: string;
  handover: boolean;
  reason?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateRequest {
  systemPrompt: string;
  history: ChatMessage[];
  variables?: Record<string, string>;
}

export class AgentCore {
  async generate(request: GenerateRequest): Promise<LLMResponse> {
    // Build final system prompt with variable injection
    const prompt = this.injectVariables(request.systemPrompt, request.variables || {});
    
    try {
      // Build messages for LLM with conversation history
      const messages = [
        { role: 'system', content: prompt },
        ...request.history
      ];

      // Call OpenRouter API with the same configuration as production
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ccl-3-final.onrender.com',
          'X-Title': 'OfferLogix V2'
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'openai/gpt-4o',
          messages,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenRouter API');
      }

      // Try to parse JSON response first - handle code fences
      try {
        // Clean up potential code fences and extra whitespace
        const cleanContent = content.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        
        const parsed: OpenRouterResponse = JSON.parse(cleanContent);
        if (parsed.reply && typeof parsed.handover === 'boolean') {
          return parsed;
        }
      } catch {
        // If not JSON, treat as plain text response
      }

      // Fallback: treat response as plain text and detect handover
      const shouldHandover = this.detectHandoverTriggers(content, request.variables);
      
      return {
        reply: content,
        handover: shouldHandover,
        reason: shouldHandover ? "Handover trigger detected in conversation" : undefined
      };

    } catch (error) {
      console.error('LLM generation error:', error);
      
      // Fallback to mock response on error
      const lastUserMessage = request.history
        .filter(m => m.role === 'user')
        .slice(-1)[0]?.content || '';
      
      const shouldHandover = this.detectHandoverTriggers(lastUserMessage, request.variables);
      
      if (shouldHandover) {
        return {
          reply: "I understand your request and want to make sure you get the best assistance. Let me connect you with one of our specialists who can help you right away.",
          handover: true,
          reason: "Customer requested specialist assistance"
        };
      }
      
      return {
        reply: "Thank you for your message. I'm here to help you with any questions about our vehicles and services. How can I assist you today?",
        handover: false
      };
    }
  }
  
  injectVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }
  
  detectHandoverTriggers(content: string, variables?: Record<string, string>): boolean {
    const lowerContent = content.toLowerCase();
    
    // Stricter handover patterns - only explicit requests
    const hardTriggers = [
      'price', 'payment', 'finance', 'financing', 'approval', 'quote', 
      'appt', 'appointment', 'schedule', 'trade-in', 'trade in', 
      'manager', 'human', 'real person', 'speak to someone',
      'test drive', 'visit', 'come in'
    ];
    
    // Custom triggers from variables
    const customTriggers = variables?.handoverTriggers 
      ? variables.handoverTriggers.toLowerCase().split(',').map(t => t.trim())
      : [];
    
    const allTriggers = [...hardTriggers, ...customTriggers];
    
    return allTriggers.some(trigger => lowerContent.includes(trigger));
  }
}