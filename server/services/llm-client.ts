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
  // Basic JSON repair regex patterns (remove trailing commas, fix single quotes)
  private static repairJson(input: string): string {
    if (!input) return input;
    let txt = input.trim();
    // Replace single quotes around keys/strings with double (conservative)
    if (/\{[^]*?\}/.test(txt) && txt.includes("'")) {
      txt = txt.replace(/(['\"])?([A-Za-z0-9_]+)\1\s*:/g, '"$2":');
      txt = txt.replace(/'([^']*)'/g, (_, c) => '"' + c.replace(/"/g,'\\"') + '"');
    }
    // Remove trailing commas before object/array close
    txt = txt.replace(/,\s*([}\]])/g, '$1');
    return txt;
  }
  private static resolveModel(preferred?: string) {
    // Default updated to GPT-5 Chat per platform upgrade
    return preferred || process.env.AI_MODEL || 'openai/gpt-5-chat';
  }

  // Compute a best-effort site URL for OpenRouter referer checks.
  private static getSiteReferer(): string {
    // OPENROUTER recommends sending an HTTP-Referer for analytics and allowlist checks.
    // Prefer explicit envs, then Render/Vercel defaults, then fallback to localhost.
    const explicit = process.env.OPENROUTER_SITE_URL || process.env.PUBLIC_APP_URL || process.env.APP_URL;
    const renderUrl = process.env.RENDER_EXTERNAL_URL; // auto-provided by Render
    const replit = process.env.REPLIT_DOMAINS; // legacy env name used earlier
    return (explicit || renderUrl || replit || 'http://localhost:5000').replace(/\/$/, '');
  }


  // Attempt to salvage a JSON object from a text blob (robust to pre/postamble text)
  private static extractJsonObject(text: string): string | null {
    if (!text) return null;
    try { JSON.parse(text); return text; } catch {}
    const s = String(text);
    let start = s.indexOf('{');
    while (start !== -1) {
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') { inStr = false; }
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = s.slice(start, i + 1);
            try { JSON.parse(candidate); return candidate; } catch {}
          }
        }
      }
      start = s.indexOf('{', start + 1);
    }
    return null;
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

      const referer = this.getSiteReferer();
      const response = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          // Send both headers; some proxies look for standard 'Referer', OpenRouter docs use 'HTTP-Referer'.
          'HTTP-Referer': referer,
          'Referer': referer,
          'X-Title': 'OneKeel AI Campaign Platform'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to surface OpenRouter's error body for faster diagnostics (e.g., domain not allowed).
        let bodyText = '';
        try { bodyText = await response.text(); } catch {}
        throw new Error(`HTTP ${response.status}: ${response.statusText}${bodyText ? ` :: ${bodyText}` : ''}`);
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content received from LLM');
      }

      // If JSON was requested, validate or salvage it, but do not hard-fail the flow
      if (payload.response_format?.type === 'json_object') {
        try {
          JSON.parse(content);
        } catch {
          let salvaged: string | null = this.extractJsonObject(content);
          if (!salvaged) salvaged = this.repairJson(content);
          try { if (salvaged) JSON.parse(salvaged); } catch { salvaged = null; }
          if (salvaged) content = salvaged; else console.warn('LLM returned non-JSON; upstream will coerce');
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

      throw (error instanceof Error) ? error : new Error(String(error));
    }
  }

  /**
   * Generate structured customer reply JSON envelope for downstream automation.
   * Returns parsed JSON object; tolerates minor format drift.
   */
  static async generateStructuredCustomerReply(userQuery: string, context: any = {}): Promise<any> {
    const system = `You are an automotive sales assistant. Output ONLY valid JSON matching this schema:
{
  "watermark": "NeoWorlder",
  "name": "Customer Name",
  "modified_name": "Preferred Name or empty string",
  "user_query": "The customer's last message",
  "Analysis": "Compliance with internal rules + brief reasoning",
  "type": "email" | "text",
  "quick_insights": "1-2 line summary of needs/context",
  "empathetic_response": "1 sentence empathic bridge",
  "engagement_check": "1 line about how you'll keep it focused",
  "sales_readiness": "low" | "medium" | "high",
  "Answer": "The concise reply to send (no JSON, just the reply text)",
  "retrieve_inventory_data": true | false,
  "research_queries": ["specific queries for inventory lookups"],
  "reply_required": true | false
}
Rules:
- Return valid JSON only, no markdown, no code fencing.
- If user only reacted (emoji/like) and added no text, set reply_required=false and minimal Answer.
- If inventory details are needed, set retrieve_inventory_data=true and provide research_queries.
- Prefer "type" from context.channel if provided; default to "email".`;

    const user = `Customer message: ${userQuery}
Context (JSON): ${JSON.stringify(context).slice(0, 2000)}`;

    const { content } = await this.generate({
      model: this.resolveModel('openai/gpt-5-chat'),
      system,
      user,
      json: true,
      temperature: 0.2,
      maxTokens: 1000
    });

    try {
      return JSON.parse(content);
    } catch {
      // Last resort: try to salvage embedded JSON
      try {
        const salvaged = this.extractJsonObject(content);
        return salvaged ? JSON.parse(salvaged) : {};
      } catch { return {}; }
    }
  }

  /**
   * Helper method for automotive content generation with enforced JSON
   */
  static async generateAutomotiveContent(prompt: string): Promise<LLMResponse> {
    return this.generate({
      model: this.resolveModel('openai/gpt-5-chat'),
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
      model: this.resolveModel('openai/gpt-5-chat'),
      system: 'You are an automotive campaign specialist helping create high-quality marketing campaigns and handover prompts.',
      user: prompt,
      json: opts?.json ?? false,
      temperature: opts?.temperature,
      maxTokens: opts?.maxTokens
    });

    return response.content;
  }
}