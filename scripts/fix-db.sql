-- Create missing tables that are causing errors
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  client_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_campaign_state (
  lead_id VARCHAR NOT NULL,
  campaign_id VARCHAR NOT NULL,
  responded_at TIMESTAMP,
  followup_state VARCHAR NOT NULL DEFAULT 'active',
  PRIMARY KEY (lead_id, campaign_id)
);

-- Add missing columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_window JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_criteria JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS handover_recipient TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS stop_on_complaint BOOLEAN DEFAULT false;

-- Add indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_campaigns_handover_recipient ON campaigns(handover_recipient)
WHERE handover_recipient IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_handover_criteria ON campaigns USING gin(handover_criteria)
WHERE handover_criteria IS NOT NULL;

-- Add constraints for data integrity
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_handover_recipient_not_empty') THEN
    ALTER TABLE campaigns ADD CONSTRAINT chk_handover_recipient_not_empty 
    CHECK (handover_recipient IS NULL OR length(trim(handover_recipient)) > 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_handover_criteria_valid') THEN
    ALTER TABLE campaigns ADD CONSTRAINT chk_handover_criteria_valid 
    CHECK (handover_criteria IS NULL OR jsonb_typeof(handover_criteria) = 'object');
  END IF;
END $$;