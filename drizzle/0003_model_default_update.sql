-- Migration: 0003_model_default_update
-- Purpose: Ensure existing databases use GPT-5 Mini as default model and backfill old/blank model values.
-- Safe to run multiple times (idempotent updates guarded by predicates / exception blocks).

-- 1. Ensure the column default is updated (if column exists)
DO $$ BEGIN
  ALTER TABLE ai_agent_config ALTER COLUMN model SET DEFAULT 'openai/gpt-5-mini';
EXCEPTION WHEN undefined_table THEN NULL WHEN undefined_column THEN NULL; END $$;

-- 2. Backfill existing rows that are empty or using legacy model names
UPDATE ai_agent_config
SET model = 'openai/gpt-5-mini'
WHERE model IS NULL
   OR model = ''
   OR model ILIKE 'gpt-4o-mini'
   OR model ILIKE 'openai/gpt-4o-mini'
   OR model ILIKE 'openai/gpt-4o'
   OR model ILIKE 'gpt-4o';

-- 3. (Optional) Verify outcome (uncomment to inspect during manual psql session)
-- SELECT model, COUNT(*) FROM ai_agent_config GROUP BY model ORDER BY COUNT(*) DESC;

-- End of migration.
