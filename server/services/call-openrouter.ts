/**
 * Minimal OpenRouter helper for structured JSON responses
 */

export type ORMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function callOpenRouterJSON<T = any>({
  model = 'openai/gpt-4o-mini',
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

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

  const referer = process.env.SITE_URL || 'https://offerlogix.ai';
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
    console.error('OpenRouter API Error:', {
      status: res.status,
      statusText: res.statusText,
      response: txt,
      model,
      system: system.slice(0, 100) + '...'
    });
    throw new Error(`OpenRouter error ${res.status}: ${txt}`);
  }
  
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  
  if (!content) {
    console.error('OpenRouter No Content Error:', {
      data,
      model,
      system: system.slice(0, 100) + '...'
    });
    throw new Error('No content from OpenRouter');
  }

  try {
    return JSON.parse(content) as T;
  } catch (e) {
    console.error('OpenRouter JSON Parse Error:', {
      content,
      error: e instanceof Error ? e.message : 'Unknown error',
      model,
      system: system.slice(0, 100) + '...'
    });
    throw new Error('Failed to parse OpenRouter JSON content');
  }
}

