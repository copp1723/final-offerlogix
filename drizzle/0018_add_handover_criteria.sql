-- Migration: 0018_add_handover_criteria
-- Purpose: Add handover functionality columns with proper constraints and indexes
-- Date: 2025-08-24

-- Add handover columns to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_criteria JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_recipient TEXT;

-- Add index for handover queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_campaigns_handover_recipient ON campaigns(handover_recipient)
WHERE handover_recipient IS NOT NULL;

-- Add index for JSONB handover_criteria queries
CREATE INDEX IF NOT EXISTS idx_campaigns_handover_criteria ON campaigns USING gin(handover_criteria)
WHERE handover_criteria IS NOT NULL;

-- Add constraint to ensure handover_recipient is not empty when set
ALTER TABLE campaigns ADD CONSTRAINT chk_handover_recipient_not_empty 
CHECK (handover_recipient IS NULL OR length(trim(handover_recipient)) > 0);

-- Add constraint to ensure handover_criteria is valid JSON when set
ALTER TABLE campaigns ADD CONSTRAINT chk_handover_criteria_valid 
CHECK (handover_criteria IS NULL OR jsonb_typeof(handover_criteria) = 'object');