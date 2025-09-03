-- MailMind V2 - Add Handover Brief Storage
-- Adds structured handover brief storage to conversations

-- Add handover brief column to conversations_v2
ALTER TABLE conversations_v2
  ADD COLUMN IF NOT EXISTS handover_brief JSONB DEFAULT NULL;

-- Add index for querying handover briefs (optional optimization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_v2_handover_brief_idx 
  ON conversations_v2 USING GIN (handover_brief)
  WHERE handover_brief IS NOT NULL;
