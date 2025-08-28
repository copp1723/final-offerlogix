-- Migration: 0010_add_handovers_table
-- Purpose: Create minimal handovers table for AI->Human escalation

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS handovers (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    conversation_id varchar REFERENCES conversations(id),
    reason text,
    created_at timestamp DEFAULT now() NOT NULL,
    resolved_at timestamp
  );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Migration 0010_add_handovers_table failed: %', SQLERRM;
END $$;

