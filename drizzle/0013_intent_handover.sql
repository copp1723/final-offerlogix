-- Migration: 0013_intent_handover
-- Purpose: add handover_criteria & handover_recipient to campaigns and create handover_events table

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_criteria jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_recipient text;

CREATE TABLE IF NOT EXISTS handover_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar REFERENCES campaigns(id),
  lead_id varchar REFERENCES leads(id),
  intent text NOT NULL,
  triggered_at timestamp DEFAULT now() NOT NULL
);