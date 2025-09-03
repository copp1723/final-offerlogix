-- MailMind V2 - Replace Abstract Handover Modes with Business Triggers
-- Replaces handover_mode system with practical business-focused triggers

-- Remove old abstract handover columns
ALTER TABLE campaigns_v2 
  DROP COLUMN IF EXISTS handover_mode,
  DROP COLUMN IF EXISTS handover_keywords,
  DROP COLUMN IF EXISTS handover_note;

-- Add business-focused handover configuration
ALTER TABLE campaigns_v2
  ADD COLUMN IF NOT EXISTS handover_triggers JSONB DEFAULT '{
    "pricingQuestions": false,
    "testDriveDemo": false,
    "tradeInValue": false,
    "financing": false,
    "vehicleAvailability": false,
    "urgency": false,
    "customTriggers": []
  }',
  ADD COLUMN IF NOT EXISTS handover_recipient VARCHAR(255),
  ADD COLUMN IF NOT EXISTS handover_recipient_name VARCHAR(100);

-- Remove old constraint and add new email validation
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'campaigns_v2' AND c.conname = 'valid_handover_mode'
  ) THEN
    ALTER TABLE campaigns_v2 DROP CONSTRAINT valid_handover_mode;
  END IF;
  
  -- Add email validation constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'campaigns_v2' AND c.conname = 'valid_handover_recipient'
  ) THEN
    ALTER TABLE campaigns_v2 ADD CONSTRAINT valid_handover_recipient 
      CHECK (handover_recipient IS NULL OR handover_recipient ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END$$;

-- Create index for handover triggers (GIN index for JSONB queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_v2_handover_triggers_idx 
  ON campaigns_v2 USING GIN (handover_triggers);

-- Create index for handover recipient lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_v2_handover_recipient_idx 
  ON campaigns_v2 (handover_recipient)
  WHERE handover_recipient IS NOT NULL;
