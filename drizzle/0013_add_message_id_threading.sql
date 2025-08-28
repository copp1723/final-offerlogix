-- Migration: Add Message-ID and threading support to conversation_messages table
-- This fixes the email threading problem by persisting Message-IDs for proper email client threading

-- Add Message-ID and threading columns to conversation_messages
ALTER TABLE "conversation_messages" ADD COLUMN "message_id" varchar(255);
ALTER TABLE "conversation_messages" ADD COLUMN "in_reply_to" varchar(255);
ALTER TABLE "conversation_messages" ADD COLUMN "references" text;
ALTER TABLE "conversation_messages" ADD COLUMN "email_headers" jsonb DEFAULT '{}'::jsonb;

-- Add index on message_id for fast lookups
CREATE INDEX "idx_conversation_messages_message_id" ON "conversation_messages" ("message_id");

-- Add index on in_reply_to for threading queries  
CREATE INDEX "idx_conversation_messages_in_reply_to" ON "conversation_messages" ("in_reply_to");

-- Add threading metadata to conversations table
ALTER TABLE "conversations" ADD COLUMN "thread_message_ids" text[];
ALTER TABLE "conversations" ADD COLUMN "original_message_id" varchar(255);

-- Add index for thread lookups
CREATE INDEX "idx_conversations_original_message_id" ON "conversations" ("original_message_id");