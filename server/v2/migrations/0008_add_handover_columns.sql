-- MailMind V2 - Safety migration for handover columns
-- Ensures conversations_v2 has handover_reason, handover_at, handover_brief

ALTER TABLE conversations_v2
  ADD COLUMN IF NOT EXISTS handover_reason text,
  ADD COLUMN IF NOT EXISTS handover_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS handover_brief jsonb;

-- Optional index for jsonb brief (safe, conditional)
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_v2_handover_brief_idx
  ON conversations_v2 USING GIN (handover_brief)
  WHERE handover_brief IS NOT NULL;

