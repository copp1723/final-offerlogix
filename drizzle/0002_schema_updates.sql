-- Migration: 0002_schema_updates
-- Purpose: Align production DB with current schema.ts additions and ensure missing columns exist.
-- Safe (idempotent) adds using IF NOT EXISTS; can be re-run without error.

-- Ensure campaigns.context exists (in case legacy DB missing it)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS context text NOT NULL DEFAULT '';
-- (Optional) drop default after ensuring existence
DO $$ BEGIN
  ALTER TABLE campaigns ALTER COLUMN context DROP DEFAULT;
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- Extend campaigns with new fields
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS handover_prompt text,
  ADD COLUMN IF NOT EXISTS communication_type varchar(20) DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS sms_opt_in_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms_opt_in_message text DEFAULT 'Would you like to continue this conversation via text? Reply YES to receive SMS updates.',
  ADD COLUMN IF NOT EXISTS schedule_type varchar(20) DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS scheduled_start timestamp,
  ADD COLUMN IF NOT EXISTS recurring_pattern varchar(50),
  ADD COLUMN IF NOT EXISTS recurring_days jsonb,
  ADD COLUMN IF NOT EXISTS recurring_time varchar(8),
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_execution timestamp;

-- Conversations: lead reference
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lead_id varchar;

-- Users: notification preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
  "emailNotifications": true,
  "campaignAlerts": true,
  "leadAlerts": true,
  "systemAlerts": true,
  "monthlyReports": true,
  "highEngagementAlerts": true,
  "quotaWarnings": true
}'::jsonb;

-- AI Agent Config: new columns & FK
ALTER TABLE ai_agent_config
  ADD COLUMN IF NOT EXISTS model text DEFAULT 'openai/gpt-5-mini',
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- Add FK for ai_agent_config.client_id (ignore if already exists)
DO $$ BEGIN
  ALTER TABLE ai_agent_config ADD CONSTRAINT ai_agent_config_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES clients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- (Optional) If you need to backfill context for existing campaigns beyond empty string, do it manually here.
-- UPDATE campaigns SET context = 'Default context' WHERE context = '';

-- End of migration.
