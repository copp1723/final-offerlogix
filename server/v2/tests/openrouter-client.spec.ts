import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { OpenRouterClient } from '../services/llm/OpenRouter';

describe('v2: OpenRouter client', () => {
  const originalFetch = global.fetch as any;

  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  test('returns content string', async () => {
    (global as any).fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"reply":"hi","handover":false,"reason":"ok"}' } }] }),
    });

    const c = new OpenRouterClient('key');
    const content = await c.chatJSON({ system: 's', history: [], user: 'u' });
    expect(typeof content).toBe('string');
    expect(content).toContain('reply');
  });

  test('throws on non-200', async () => {
    (global as any).fetch.mockResolvedValue({ ok: false, status: 500 });
    const c = new OpenRouterClient('key');
    await expect(c.chatJSON({ system: 's', history: [], user: 'u' })).rejects.toThrow('openrouter 500');
  });
});

