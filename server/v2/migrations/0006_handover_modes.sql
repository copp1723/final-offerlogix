-- MailMind V2 - Add Handover Mode Configuration
-- Adds deterministic handover control to campaigns

-- Add handover configuration columns to campaigns_v2
ALTER TABLE campaigns_v2
  ADD COLUMN IF NOT EXISTS handover_mode VARCHAR(20) DEFAULT 'model',
  ADD COLUMN IF NOT EXISTS handover_keywords TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS handover_note TEXT DEFAULT NULL;

-- Add constraint for handover_mode values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'campaigns_v2' AND c.conname = 'valid_handover_mode'
  ) THEN
    ALTER TABLE campaigns_v2 ADD CONSTRAINT valid_handover_mode 
      CHECK (handover_mode IN ('model', 'always', 'never', 'rule'));
  END IF;
END$$;

-- Update existing campaigns to use 'model' mode (preserves current behavior)
UPDATE campaigns_v2 
SET handover_mode = 'model' 
WHERE handover_mode IS NULL;

-- Make handover_mode NOT NULL after setting defaults
ALTER TABLE campaigns_v2 
  ALTER COLUMN handover_mode SET NOT NULL;

-- Add index for handover mode queries (optional optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_v2_handover_mode_idx 
  ON campaigns_v2 (handover_mode);
