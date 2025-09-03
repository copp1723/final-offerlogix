import { LLMClient } from './llm-client';
import { INTENT_SYSTEM_PROMPT, buildIntentUserPrompt } from './intent-prompts';

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
  confidence: number; // 0-100
}

/**
 * Call LLM to classify message into automotive intents with confidence scores.
 */
export async function detectIntents(message: string): Promise<DetectedIntent[]> {
  if (!message?.trim()) {
    return [{ intent: 'other', confidence: 0 }];
  }

  try {
    const { content } = await LLMClient.generate({
      model: process.env.INTENT_MODEL || 'openai/gpt-4o-mini',
      system: INTENT_SYSTEM_PROMPT,
      user: buildIntentUserPrompt(message),
      json: true,
      maxTokens: 300,
      temperature: 0.2,
    });

    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.intents)) {
      return (parsed.intents as Array<{ intent: string; confidence: number }>)
        .map((i) => ({ intent: i.intent as Intent, confidence: Number(i.confidence) }))
        .filter((i: DetectedIntent) => i.intent)
        .sort((a: DetectedIntent, b: DetectedIntent) => b.confidence - a.confidence);
    }
  } catch (error) {
    console.warn('Intent detection failed', error);
  }
  return [{ intent: 'other', confidence: 0 }];
}

/**
 * Convenience helper returning highest confidence intent only.
 */
export async function detectIntent(message: string): Promise<Intent> {
  const intents = await detectIntents(message);
  return intents[0]?.intent || 'other';
}

/**
 * Analyze multiple messages as a single conversation for intent detection.
 */
export async function detectIntentFromConversation(messages: string[]): Promise<Intent> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'other';
  }
  const combined = messages.filter(Boolean).join(' ').trim();
  return detectIntent(combined);
}

/**
 * Human readable descriptions for intents.
 */
export function getIntentDescription(intent: Intent): string {
  const descriptions: Record<Intent, string> = {
    pricing: 'Customer is asking about pricing, costs, or payment options',
    test_drive: 'Customer wants to schedule a test drive',
    trade_in: 'Customer is interested in trading their current vehicle',
    financing: 'Customer is asking about financing options or loan terms',
    availability: 'Customer is checking vehicle availability or delivery timeline',
    features: 'Customer is asking about vehicle features or specifications',
    appointment: 'Customer wants to schedule an appointment or visit',
    complaint: 'Customer has a complaint or negative experience',
    other: 'General inquiry or intent not clearly identified',
  };
  return descriptions[intent] || descriptions.other;
}