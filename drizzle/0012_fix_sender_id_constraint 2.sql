-- Fix foreign key constraint on conversation_messages.sender_id to allow null values
-- This allows system messages (AI replies, lead replies) to have null sender_id

-- Drop the existing foreign key constraint
ALTER TABLE "conversation_messages" DROP CONSTRAINT IF EXISTS "conversation_messages_sender_id_users_id_fk";

-- Add the constraint back but allow null values (which foreign keys naturally allow)
-- Note: Foreign key constraints in PostgreSQL naturally allow NULL values
-- The issue was that the application was inserting 'lead-reply' and 'ai-agent' strings
-- instead of NULL values
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sender_id_users_id_fk" 
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;