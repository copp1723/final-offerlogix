/**
 * Unified LLM client for consistent API calls across the application
 * Provides timeout, retry, JSON formatting, and metrics tracking
 */

interface LLMOptions {
  model: string;
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  seed?: number;
}

interface LLMResponse {
  content: string;
  tokens?: number;
  latency: number;
}

export class LLMClient {
  private static readonly BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly MAX_RETRIES = 3;
  private static resolveModel(preferred?: string) {
    return preferred || process.env.AI_MODEL || 'openai/gpt-5-mini';
  }
  
  /**
   * Generate content using the unified LLM client
   */
  static async generate(options: LLMOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    
    const payload: any = {
      model: this.resolveModel(options.model),
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.user }
      ],
      temperature: options.temperature ?? (options.json ? 0.2 : 0.7),
      max_tokens: options.maxTokens ?? (options.json ? 1200 : 2000),
    };

    if (options.json) {
      payload.response_format = { type: 'json_object' };
    }

    if (options.seed !== undefined) {
      payload.seed = options.seed;
    }

    return this.executeWithRetry(payload, startTime);
  }

  /**
   * Execute request with retry logic and exponential backoff
   */
  private static async executeWithRetry(payload: any, startTime: number, attempt = 1): Promise<LLMResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);

      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.REPLIT_DOMAINS || 'http://localhost:5000',
          'X-Title': 'OneKeel AI Campaign Platform'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from LLM');
      }

      // If JSON was requested, validate it
      if (payload.response_format?.type === 'json_object') {
        try {
          JSON.parse(content);
        } catch (error) {
          throw new Error('Invalid JSON response from LLM');
        }
      }

      const latency = Date.now() - startTime;
      
      return {
        content,
        tokens: data.usage?.total_tokens,
        latency
      };

    } catch (error) {
      if (attempt < this.MAX_RETRIES && !(error instanceof Error && error.name?.includes('AbortError'))) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // For JSON responses, ensure strict mode on retry
        if (payload.response_format?.type === 'json_object' && attempt > 1) {
          payload.temperature = 0.2;
        }
        
        return this.executeWithRetry(payload, startTime, attempt + 1);
      }
      
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Helper method for automotive content generation with enforced JSON
   */
  static async generateAutomotiveContent(prompt: string): Promise<LLMResponse> {
    return this.generate({
      model: this.resolveModel('openai/gpt-5-mini'),
      system: 'You are an expert automotive marketing AI assistant. Always respond with valid JSON.',
      user: prompt,
      json: true,
      temperature: 0.2,
      maxTokens: 1200
    });
  }

  /**
   * Legacy compatibility method for generateContent calls
   */
  static async generateContent(
    prompt: string, 
    opts?: { json?: boolean; temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const response = await this.generate({
      model: this.resolveModel('openai/gpt-5-mini'),
      system: 'You are an automotive campaign specialist helping create high-quality marketing campaigns and handover prompts.',
      user: prompt,
      json: opts?.json ?? false,
      temperature: opts?.temperature,
      maxTokens: opts?.maxTokens
    });
    
    return response.content;
  }
}