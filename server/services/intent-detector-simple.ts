import { LLMClient } from './llm-client';
import { INTENT_CLASSIFICATION_SYSTEM_PROMPT } from './intent-classification-prompt';

export type Intent =
  | 'pricing'
  | 'test_drive'
  | 'trade_in'
  | 'financing'
  | 'availability'
  | 'features'
  | 'appointment'
  | 'complaint'
  | 'other';

export interface DetectedIntent {
  intent: Intent;
  confidence: number;
}

export interface IntentDetectionResult {
  leadMessage: string;
  intents: DetectedIntent[];
  latency: number;
}

const VALID_INTENTS: Intent[] = [
  'pricing',
  'test_drive',
  'trade_in',
  'financing',
  'availability',
  'features',
  'appointment',
  'complaint',
  'other'
];

/**
 * Detect intents in a message using LLM-based classification
 * Returns multiple intents with confidence scores
 */
export async function detectIntents(message: string): Promise<IntentDetectionResult> {
  const leadMessage = message || '';
  if (!leadMessage.trim()) {
    return { leadMessage, intents: [{ intent: 'other', confidence: 0 }], latency: 0 };
  }

  const start = Date.now();
  const { content, latency } = await LLMClient.generate({
    model: 'openai/gpt-4o-mini',
    system: INTENT_CLASSIFICATION_SYSTEM_PROMPT,
    user: leadMessage,
    json: true,
    maxTokens: 200,
    temperature: 0
  });

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }

  const intents: DetectedIntent[] = Array.isArray(parsed?.intents)
    ? parsed.intents
        .filter((i: any) => VALID_INTENTS.includes(i.intent))
        .map((i: any) => ({ intent: i.intent as Intent, confidence: Number(i.confidence) || 0 }))
    : [];

  if (intents.length === 0) {
    intents.push({ intent: 'other', confidence: 0 });
  }

  const totalLatency = latency ?? Date.now() - start;
  if (totalLatency > 500) {
    console.warn(`Intent classification latency ${totalLatency}ms exceeds 500ms threshold`);
  }

  return { leadMessage, intents, latency: totalLatency };
}