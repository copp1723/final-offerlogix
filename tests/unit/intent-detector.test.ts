import { detectIntents } from '../../server/services/intent-detector-simple';
import { detectIntent, detectIntentFromConversation, getIntentDescription } from '../../server/services/intent-detector';
import { LLMClient } from '../../server/services/llm-client';

jest.mock('../../server/services/llm-client', () => ({
  LLMClient: { generate: jest.fn() }
}));

const mockGenerate = LLMClient.generate as jest.Mock;

beforeEach(() => {
  mockGenerate.mockReset();
});

test('detectIntents returns intents with confidence', async () => {
  mockGenerate.mockResolvedValue({
    content: JSON.stringify({ intents: [{ intent: 'pricing', confidence: 0.92 }] }),
    latency: 100
  });
  const result = await detectIntents('What is the price?');
  expect(result.intents[0]).toEqual({ intent: 'pricing', confidence: 0.92 });
});

test('detectIntent selects highest confidence intent', async () => {
  mockGenerate.mockResolvedValue({
    content: JSON.stringify({ intents: [
      { intent: 'pricing', confidence: 0.9 },
      { intent: 'appointment', confidence: 0.4 }
    ] }),
    latency: 100
  });
  const intent = await detectIntent('Price and schedule?');
  expect(intent).toBe('pricing');
});

test('detectIntentFromConversation analyzes combined messages', async () => {
  mockGenerate.mockResolvedValue({
    content: JSON.stringify({ intents: [{ intent: 'appointment', confidence: 0.8 }] }),
    latency: 100
  });
  const intent = await detectIntentFromConversation(['Can I visit?', 'Need to schedule']);
  expect(intent).toBe('appointment');
});

test('getIntentDescription returns text', () => {
  expect(getIntentDescription('pricing')).toContain('pricing');
});