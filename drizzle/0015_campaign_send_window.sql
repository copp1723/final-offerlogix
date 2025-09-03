-- Add optional send window for campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "send_window" jsonb;