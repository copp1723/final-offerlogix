-- Migration: Add fromName field to ai_agent_config table
-- Description: Adds a dedicated fromName field for custom email sender display names

-- Add fromName column to ai_agent_config table
ALTER TABLE ai_agent_config
ADD COLUMN from_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN ai_agent_config.from_name IS 'Dedicated email From: display name (e.g., "Riley Donovan")';
