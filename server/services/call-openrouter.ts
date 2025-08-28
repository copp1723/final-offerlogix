/**
 * Minimal OpenRouter helper for structured JSON responses
 */

import { getEnv } from '../env';
import { createErrorContext, categorizeError, getErrorMessage } from '../utils/error-utils';
import { log } from '../logging/logger';

export type ORMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function callOpenRouterJSON<T = any>({
  model = 'openai/gpt-5-chat',
  system,
  messages,
  temperature = 0.2,
  maxTokens = 1000,
}: {
  model?: string;
  system: string;
  messages: ORMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const env = getEnv();
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    log.error('OPENROUTER_API_KEY not set', {
      component: 'ai',
      operation: 'openrouter_call',
      error: new Error('OPENROUTER_API_KEY not set'),
      model
    });
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const payload: any = {
    model,
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };

  const referer = env.SITE_URL;
  const startTime = performance.now();
  
  log.info('Starting OpenRouter API call', {
    component: 'ai',
    operation: 'openrouter_call',
    model,
    messageCount: messages.length,
    temperature,
    maxTokens,
    systemPromptLength: system.length
  });
  
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': referer,
      'Referer': referer,
      'X-Title': 'OfferLogix Outbound AI',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const duration = performance.now() - startTime;
    const error = new Error(`OpenRouter error ${res.status}: ${txt}`);
    const errorContext = createErrorContext(error, {
      status: res.status,
      statusText: res.statusText,
      response: txt.slice(0, 500),
      model,
      system: system.slice(0, 100) + '...'
    });
    
    log.ai('OpenRouter API call failed', {
      provider: 'openrouter',
      model,
      latency: Math.round(duration),
      cost: 0, // Could calculate based on token usage
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: 0,
      component: 'ai',
      operation: 'openrouter_call',
      error,
      httpStatus: res.status,
      httpStatusText: res.statusText
    });
    
    throw error;
  }
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  const duration = performance.now() - startTime;
  
  if (!content) {
    const error = new Error('No content from OpenRouter');
    const errorContext = createErrorContext(error, {
      data,
      model,
      system: system.slice(0, 100) + '...'
    });
    
    log.ai('OpenRouter API call returned no content', {
      provider: 'openrouter',
      model,
      latency: Math.round(duration),
      cost: 0,
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: 0,
      component: 'ai',
      operation: 'openrouter_call',
      error,
      usage: data?.usage
    });
    
    throw error;
  }

  try {
    const parsedResult = JSON.parse(content) as T;
    
    // Log successful AI operation
    log.ai('OpenRouter API call successful', {
      provider: 'openrouter',
      model,
      latency: Math.round(duration),
      cost: 0, // Could calculate based on token usage
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: content.length,
      tokenCount: {
        input: data?.usage?.prompt_tokens || 0,
        output: data?.usage?.completion_tokens || 0,
        total: data?.usage?.total_tokens || 0
      },
      component: 'ai',
      operation: 'openrouter_call',
      usage: data?.usage
    });
    
    return parsedResult;
  } catch (e) {
    const parseError = new Error('Failed to parse OpenRouter JSON content');
    const errorContext = createErrorContext(parseError, {
      content: content.slice(0, 500),
      originalError: getErrorMessage(e),
      model,
      system: system.slice(0, 100) + '...',
      errorCategory: categorizeError(e)
    });
    
    log.ai('OpenRouter JSON parse failed', {
      provider: 'openrouter',
      model,
      latency: Math.round(duration),
      cost: 0,
      promptLength: system.length + messages.reduce((acc, m) => acc + m.content.length, 0),
      responseLength: content.length,
      component: 'ai',
      operation: 'openrouter_call',
      error: parseError,
      rawContent: content.slice(0, 200)
    });
    
    throw parseError;
  }
}

