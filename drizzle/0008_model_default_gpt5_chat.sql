-- Migration: 0008_model_default_gpt5_chat
-- Purpose: Update ai_agent_config.model default to openai/gpt-5-chat and backfill prior values.
-- Notes: Forward-only migration retaining history.

DO $$ BEGIN
  ALTER TABLE ai_agent_config ALTER COLUMN model SET DEFAULT 'openai/gpt-5-chat';
EXCEPTION WHEN undefined_table THEN NULL WHEN undefined_column THEN NULL; END $$;

UPDATE ai_agent_config
SET model = 'openai/gpt-5-chat'
WHERE model IS NULL
   OR model = ''
   OR model ILIKE 'openai/gpt-5-mini'
   OR model ILIKE 'gpt-5-mini'
   OR model ILIKE 'openai/gpt-4o-mini'
   OR model ILIKE 'gpt-4o-mini'
   OR model ILIKE 'openai/gpt-4o'
   OR model ILIKE 'gpt-4o';

-- End migration 0008.
