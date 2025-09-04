-- Add missing handover_criteria column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS handover_criteria JSONB DEFAULT '{}'::jsonb;