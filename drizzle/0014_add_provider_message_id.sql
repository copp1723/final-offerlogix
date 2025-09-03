-- Provider message id + uniqueness (survives process restarts)
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_convmsg_provider_id
ON conversation_messages (provider_message_id)
WHERE provider_message_id IS NOT NULL;