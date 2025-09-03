-- Migration: Add provider_message_id for V2 webhook handling
-- Purpose: Add provider_message_id column to track Mailgun message IDs for status updates

-- Add provider_message_id column for webhook correlation
ALTER TABLE "messages_v2" 
ADD COLUMN IF NOT EXISTS "provider_message_id" varchar(255);

-- Add index for provider_message_id lookups (webhook performance)
CREATE INDEX IF NOT EXISTS "messages_v2_provider_message_id_idx" 
ON "messages_v2" ("provider_message_id")
WHERE "provider_message_id" IS NOT NULL;

-- Add unique constraint to prevent duplicate provider message IDs
ALTER TABLE "messages_v2"
ADD CONSTRAINT "messages_v2_provider_message_id_unique" 
UNIQUE ("provider_message_id");
