-- Migration: 0019_add_lead_scores  
-- Purpose: Track lead scores over time and add campaign scoring configuration
-- Date: 2025-08-25

-- Add scoring configuration to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS lead_score_weights jsonb;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_score_thresholds jsonb;

-- Create lead scores tracking table
CREATE TABLE IF NOT EXISTS lead_scores (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar REFERENCES campaigns(id),
  lead_id varchar REFERENCES leads(id),
  score integer NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_scores_lead_id ON lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_campaign_id ON lead_scores(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_created_at ON lead_scores(created_at);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score);