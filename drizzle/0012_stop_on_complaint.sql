-- Add stop_on_complaint flag to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "stop_on_complaint" boolean DEFAULT false;