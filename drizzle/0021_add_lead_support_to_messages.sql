-- Migration: Add lead support to conversation messages
-- This allows leads (not just users) to send messages in conversations
-- Required for Mailgun inbound webhook to store lead replies

-- Add lead_id column to conversation_messages table
ALTER TABLE conversation_messages 
ADD COLUMN lead_id VARCHAR REFERENCES leads(id);

-- Make sender_id nullable (so either sender_id OR lead_id can be set)
ALTER TABLE conversation_messages 
ALTER COLUMN sender_id DROP NOT NULL;

-- Add check constraint to ensure either sender_id OR lead_id is present (but not both)
ALTER TABLE conversation_messages 
ADD CONSTRAINT check_sender_or_lead 
CHECK (
  (sender_id IS NOT NULL AND lead_id IS NULL) OR 
  (sender_id IS NULL AND lead_id IS NOT NULL)
);

-- Add index for lead_id to improve query performance
CREATE INDEX idx_conversation_messages_lead_id ON conversation_messages(lead_id);

-- Update comment for clarity
COMMENT ON TABLE conversation_messages IS 'Messages in conversations - can be from users (sender_id) or leads (lead_id)';
COMMENT ON COLUMN conversation_messages.sender_id IS 'User ID when message is from a user (nullable when from lead)';
COMMENT ON COLUMN conversation_messages.lead_id IS 'Lead ID when message is from a lead (nullable when from user)';