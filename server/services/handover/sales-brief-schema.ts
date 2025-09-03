import type { HandoverIntent } from '@shared/schema';

export interface SalesBriefMessage {
  sender: 'lead' | 'ai';
  content: string;
  timestamp: string;
}

export interface SalesBrief {
  leadId: string;
  campaignId: string;
  handoverReason: 'intent_trigger' | 'manual' | 'rule_threshold';
  detectedIntents: HandoverIntent[];
  triggeredAt: string;
  leadEmail?: string;
  campaignName?: string;
  transcript: SalesBriefMessage[];
}