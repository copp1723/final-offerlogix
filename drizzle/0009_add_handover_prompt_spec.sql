-- Migration: 0009_add_handover_prompt_spec
-- Purpose: Add handover_prompt_spec column to campaigns table
-- Notes: This column stores structured JSON spec for handover signal categories and thresholds

DO $$ BEGIN
  ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_prompt_spec jsonb;
EXCEPTION WHEN undefined_table THEN 
  RAISE NOTICE 'Table campaigns does not exist';
END $$;

-- End migration 0009