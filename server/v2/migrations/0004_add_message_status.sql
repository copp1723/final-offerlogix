-- Migration: Add message status and attempts tracking
-- Purpose: Add status field for message delivery tracking and future attempts column

-- Add status column for message delivery tracking
ALTER TABLE "messages_v2" 
ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'pending';

-- Add check constraint for valid status values
ALTER TABLE "messages_v2"
ADD CONSTRAINT "messages_v2_valid_status_check" 
CHECK ("status" IN ('pending', 'sent', 'failed'));

-- Add references column for email threading (if not exists)
ALTER TABLE "messages_v2"
ADD COLUMN IF NOT EXISTS "references" text;

-- Add aiModel column for tracking which model generated the message
ALTER TABLE "messages_v2"
ADD COLUMN IF NOT EXISTS "ai_model" text;

-- Future-ready: Add attempts column for retry tracking (commented out for now)
-- ALTER TABLE "messages_v2" 
-- ADD COLUMN IF NOT EXISTS "attempts" integer NOT NULL DEFAULT 0;

-- Add index for status lookups
CREATE INDEX IF NOT EXISTS "messages_v2_status_idx" ON "messages_v2" ("status");

-- Add index for references column (for threading performance)
CREATE INDEX IF NOT EXISTS "messages_v2_references_idx" ON "messages_v2" ("references")
WHERE "references" IS NOT NULL;
