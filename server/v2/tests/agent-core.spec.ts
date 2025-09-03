import { describe, test, expect, jest } from '@jest/globals';
import { AgentCore } from '../agent-core/AgentCore';

const makeCore = (responses: Array<string>) => {
  const fetchJSON = jest.fn(async (_body: any) => responses.shift()!);
  const sanitizer = (s: string) => s.replace(/<[^>]+>/g, '').replace(/bad/gi, 'good');
  return { core: new AgentCore({ fetchJSON, sanitizer }), fetchJSON };
};

describe('v2: AgentCore', () => {
  test('good JSON returns parsed result', async () => {
    const { core, fetchJSON } = makeCore([
      JSON.stringify({ reply: 'Hello', handover: false, reason: 'ok' }),
    ]);

    const res = await core.generate({
      agentId: 'a1',
      globalPrompt: 'You are {{role}} at {{dealership}}',
      vars: { role: 'Sales', dealership: 'Kunes' },
      history: [],
      userText: 'Hi',
    });

    expect(res).toEqual({ reply: 'Hello', handover: false, reason: 'ok' });
    expect(fetchJSON).toHaveBeenCalledTimes(1);
  });

  test('malformed -> retry -> OK', async () => {
    const { core, fetchJSON } = makeCore([
      'not-json',
      JSON.stringify({ reply: 'Fixed', handover: false, reason: 'recovered' }),
    ]);

    const res = await core.generate({
      agentId: 'a1',
      globalPrompt: 'G {{x}}',
      vars: { x: '1' },
      history: [],
      userText: 'Hi',
    });

    expect(res.reply).toBe('Fixed');
    expect(res.handover).toBe(false);
    expect(res.reason).toBe('recovered');
    expect(fetchJSON).toHaveBeenCalledTimes(2);
  });

  test('malformed -> fallback', async () => {
    const { core, fetchJSON } = makeCore(['oops', 'still nope']);
    const res = await core.generate({
      agentId: 'a1',
      globalPrompt: 'G',
      vars: {},
      history: [],
      userText: 'Hi',
    });

    expect(res).toEqual({
      reply: 'Thanks—looping in a specialist.',
      handover: true,
      reason: 'malformed_output',
    });
    expect(fetchJSON).toHaveBeenCalledTimes(2);
  });

  test('word cap and sanitizer applied', async () => {
    const longReply = Array.from({ length: 200 }, (_, i) => (i % 10 === 0 ? 'bad' : 'word')).join(' ');
    const { core } = makeCore([
      JSON.stringify({ reply: longReply, handover: false, reason: '<b>ok</b>' }),
    ]);

    const res = await core.generate({
      agentId: 'a1',
      globalPrompt: 'G',
      vars: {},
      history: [],
      userText: 'Hi',
    });

    const wordCount = res.reply.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(120);
    expect(res.reply).not.toMatch(/<b>/);
    expect(res.reply).toMatch(/good/); // sanitizer replaced 'bad' with 'good'
    expect(res.reason).toBe('ok');
  });
});

