import { detectIntents, type Intent, type IntentDetectionResult } from './intent-detector-simple';
import { storage } from '../storage';
import { db } from '../db';
import { handoverEvents } from '@shared/schema';
import { calculateLeadScore, DEFAULT_SCORE_THRESHOLDS } from './lead-score';

export async function evaluateMessageForHandover(params: {
  campaignId: string;
  leadId: string;
  message: string;
}): Promise<{ intents: IntentDetectionResult['intents']; handoverTriggered: boolean; matched?: Intent; score: number; action: 'immediate' | 'scheduled' | 'none'; }> {
  const { campaignId, leadId, message } = params;
  const campaign = await storage.getCampaign(campaignId);
  const criteria = Array.isArray((campaign as any)?.handoverCriteria) ? (campaign as any).handoverCriteria : [];

  // Calculate lead score using campaign weights
  const campaignWeights = (campaign as any)?.leadScoreWeights || {};
  const score = calculateLeadScore([message], campaignWeights);
  await storage.insertLeadScore({ leadId, campaignId, score });

  // Get score thresholds from campaign or use defaults
  const thresholds = (campaign as any)?.handoverScoreThresholds || DEFAULT_SCORE_THRESHOLDS;
  
  let action: 'immediate' | 'scheduled' | 'none' = 'none';
  if (score >= thresholds.immediate) {
    action = 'immediate';
  } else if (score >= thresholds.scheduled) {
    action = 'scheduled';
  }

  // Early exit if score is too low
  if (action === 'none') {
    return { intents: [], handoverTriggered: false, score, action };
  }

  const { intents } = await detectIntents(message || '');
  const criteriaIntents = criteria.map((c: any) => (typeof c === 'string' ? c : c.intent));
  const matched = intents.find((i) => criteriaIntents.includes(i.intent));
  
  const handoverTriggered = Boolean(matched && action === 'immediate');
  if (handoverTriggered) {
    await db.insert(handoverEvents).values({ campaignId, leadId, intent: matched!.intent }).returning();
  }

  return { intents, handoverTriggered, matched: matched?.intent, score, action };
}