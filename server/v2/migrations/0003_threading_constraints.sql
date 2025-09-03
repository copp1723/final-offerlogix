-- Add threading-specific constraints and indexes
-- Ensures Message-ID uniqueness and improves conversation lookup performance

-- Critical: Ensure Message-ID uniqueness across all messages
ALTER TABLE "messages_v2" 
ADD CONSTRAINT "messages_v2_message_id_unique" UNIQUE ("message_id");

-- Improve conversation lookup performance (already exists but adding comment)
-- conversations_v2_routing_idx ON (agent_id, lead_email) -- Already exists from 0001

-- Index for In-Reply-To lookups during threading
CREATE INDEX "messages_v2_in_reply_to_idx" ON "messages_v2" ("in_reply_to") 
WHERE "in_reply_to" IS NOT NULL;

-- Index for conversation + created_at performance (already exists)
-- messages_v2_conversation_time_idx ON (conversation_id, created_at) -- Already exists

-- Add check constraint for valid sender types
ALTER TABLE "messages_v2"
ADD CONSTRAINT "messages_v2_valid_sender_check" 
CHECK ("sender" IN ('agent', 'lead'));

-- Add check constraint for valid conversation status
ALTER TABLE "conversations_v2"
ADD CONSTRAINT "conversations_v2_valid_status_check"
CHECK ("status" IN ('active', 'handed_over', 'archived'));