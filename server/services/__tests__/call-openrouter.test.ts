import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { callOpenRouterJSON } from '../call-openrouter';

describe('callOpenRouterJSON', () => {
  const prev = { ...process.env } as any;
  beforeAll(() => {
    process.env.OPENROUTER_API_KEY = 'test';
  });
  afterAll(() => {
    process.env.OPENROUTER_API_KEY = prev.OPENROUTER_API_KEY;
  });

  it('throws on non-JSON content', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] })
    } as any);

    await expect(callOpenRouterJSON({ system: 'x', messages: [{ role: 'user', content: 'y' }] } as any)).rejects.toThrow('Failed to parse OpenRouter JSON content');
    fetchSpy.mockRestore();
  });
});

