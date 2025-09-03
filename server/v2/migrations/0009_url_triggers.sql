-- MailMind V2 - URL Trigger System
-- Automatically send relevant URLs when customers ask about specific topics

-- Add URL triggers configuration to campaigns
ALTER TABLE campaigns_v2
  ADD COLUMN IF NOT EXISTS url_triggers JSONB DEFAULT '{
    "tradeInUrl": {"enabled": false, "url": "", "message": ""},
    "schedulerUrl": {"enabled": false, "url": "", "message": ""},
    "financingUrl": {"enabled": false, "url": "", "message": ""},
    "inventoryUrl": {"enabled": false, "url": "", "message": ""},
    "warrantyUrl": {"enabled": false, "url": "", "message": ""},
    "customUrls": []
  }';

-- Create GIN index for efficient JSONB queries on URL triggers
CREATE INDEX CONCURRENTLY IF NOT EXISTS campaigns_v2_url_triggers_idx 
  ON campaigns_v2 USING GIN (url_triggers);

-- Add constraint to ensure URLs are valid HTTP/HTTPS when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'campaigns_v2' AND c.conname = 'valid_url_triggers'
  ) THEN
    ALTER TABLE campaigns_v2 ADD CONSTRAINT valid_url_triggers 
      CHECK (
        url_triggers IS NULL OR 
        (
          (url_triggers->'tradeInUrl'->>'url' IS NULL OR url_triggers->'tradeInUrl'->>'url' ~ '^https?://') AND
          (url_triggers->'schedulerUrl'->>'url' IS NULL OR url_triggers->'schedulerUrl'->>'url' ~ '^https?://') AND
          (url_triggers->'financingUrl'->>'url' IS NULL OR url_triggers->'financingUrl'->>'url' ~ '^https?://') AND
          (url_triggers->'inventoryUrl'->>'url' IS NULL OR url_triggers->'inventoryUrl'->>'url' ~ '^https?://') AND
          (url_triggers->'warrantyUrl'->>'url' IS NULL OR url_triggers->'warrantyUrl'->>'url' ~ '^https?://')
        )
      );
  END IF;
END$$;
