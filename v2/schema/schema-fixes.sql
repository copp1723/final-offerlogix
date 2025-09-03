-- MailMind V2 Schema Fixes and Improvements (production-safe, idempotent)

-- NOTE: Run index creations with CONCURRENTLY **outside** a transaction in prod.
--       Drizzle migrations typically run in a transaction; split if needed.

-- 1) Column type hardening (safe changes)
ALTER TABLE agents_v2    ALTER COLUMN domain     TYPE varchar(255);
ALTER TABLE agents_v2    ALTER COLUMN local_part TYPE varchar(100);
ALTER TABLE messages_v2  ALTER COLUMN message_id TYPE varchar(255);
ALTER TABLE messages_v2  ALTER COLUMN in_reply_to TYPE varchar(255);

-- 2) Check constraints (guarded so re-runs don't fail)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'agents_v2' AND c.conname = 'ck_agents_conversation_limit_positive'
  ) THEN
    ALTER TABLE agents_v2 ADD CONSTRAINT ck_agents_conversation_limit_positive 
      CHECK (conversation_limit IS NULL OR conversation_limit > 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'campaigns_v2' AND c.conname = 'ck_campaigns_status'
  ) THEN
    ALTER TABLE campaigns_v2 ADD CONSTRAINT ck_campaigns_status 
      CHECK (status IN ('draft', 'active', 'paused', 'completed'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'leads_v2' AND c.conname = 'ck_leads_status'
  ) THEN
    ALTER TABLE leads_v2 ADD CONSTRAINT ck_leads_status 
      CHECK (status IN ('active', 'responded', 'handed_over', 'unsubscribed'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'conversations_v2' AND c.conname = 'ck_conversations_status'
  ) THEN
    ALTER TABLE conversations_v2 ADD CONSTRAINT ck_conversations_status 
      CHECK (status IN ('active', 'handed_over', 'archived'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'messages_v2' AND c.conname = 'ck_messages_sender'
  ) THEN
    ALTER TABLE messages_v2 ADD CONSTRAINT ck_messages_sender 
      CHECK (sender IN ('agent', 'lead'));
  END IF;
END$$;

-- 3) Email validation helpers (idempotent)
CREATE OR REPLACE FUNCTION validate_email(email_text TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'leads_v2' AND c.conname = 'ck_leads_email_valid'
  ) THEN
    ALTER TABLE leads_v2 ADD CONSTRAINT ck_leads_email_valid 
      CHECK (validate_email(email));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'agents_v2' AND c.conname = 'ck_agents_email_format'
  ) THEN
    ALTER TABLE agents_v2 ADD CONSTRAINT ck_agents_email_format 
      CHECK (local_part ~ '^[a-zA-Z0-9._-]+$' AND domain ~ '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
  END IF;
END$$;

-- 4) Unique/Lookup indexes (match V2 plan; avoid duplicate constraints)
-- Agent uniqueness per client (email identity)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_agents_client_domain_local
  ON agents_v2 (client_id, domain, local_part);

-- Campaign lead dedupe
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_leads_campaign_email
  ON leads_v2 (campaign_id, email);

-- One conversation per (agent, lead) + fast lookup
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_conversations_agent_lead
  ON conversations_v2 (agent_id, lead_email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_conversations_agent_lead
  ON conversations_v2 (agent_id, lead_email);

-- Message-ID uniqueness + chronological lookup
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_messages_message_id
  ON messages_v2 (message_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_messages_conversation_created
  ON messages_v2 (conversation_id, created_at);

-- Optional routing/analytics helpers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_routing 
  ON conversations_v2 (agent_id, lead_email, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_agent_campaign 
  ON leads_v2 (agent_id, campaign_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_agent_status 
  ON campaigns_v2 (agent_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_handover_tracking 
  ON conversations_v2 (status, handover_at) WHERE status = 'handed_over';

-- 5) FK repair: switch to ON DELETE CASCADE (guarded)
DO $$
BEGIN
  -- campaigns → agents
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='campaigns_v2' AND constraint_type='FOREIGN KEY'
  ) THEN
    -- Best-effort drop by name if present
    BEGIN
      ALTER TABLE campaigns_v2 DROP CONSTRAINT IF EXISTS fk_campaigns_agent;
      ALTER TABLE campaigns_v2 DROP CONSTRAINT IF EXISTS campaigns_v2_agent_id_agents_v2_id_fk;
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
  ALTER TABLE campaigns_v2 ADD CONSTRAINT fk_campaigns_agent
    FOREIGN KEY (agent_id) REFERENCES agents_v2(id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE campaigns_v2 VALIDATE CONSTRAINT fk_campaigns_agent;
END$$;

DO $$
BEGIN
  -- leads → campaigns
  BEGIN
    ALTER TABLE leads_v2 DROP CONSTRAINT IF EXISTS fk_leads_campaign;
    ALTER TABLE leads_v2 DROP CONSTRAINT IF EXISTS leads_v2_campaign_id_campaigns_v2_id_fk;
  EXCEPTION WHEN others THEN NULL;
  END;
  ALTER TABLE leads_v2 ADD CONSTRAINT fk_leads_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns_v2(id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE leads_v2 VALIDATE CONSTRAINT fk_leads_campaign;
END$$;

DO $$
BEGIN
  -- conversations → agents
  BEGIN
    ALTER TABLE conversations_v2 DROP CONSTRAINT IF EXISTS fk_conversations_agent;
    ALTER TABLE conversations_v2 DROP CONSTRAINT IF EXISTS conversations_v2_agent_id_agents_v2_id_fk;
  EXCEPTION WHEN others THEN NULL;
  END;
  ALTER TABLE conversations_v2 ADD CONSTRAINT fk_conversations_agent
    FOREIGN KEY (agent_id) REFERENCES agents_v2(id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE conversations_v2 VALIDATE CONSTRAINT fk_conversations_agent;
END$$;

DO $$
BEGIN
  -- messages → conversations
  BEGIN
    ALTER TABLE messages_v2 DROP CONSTRAINT IF EXISTS fk_messages_conversation;
    ALTER TABLE messages_v2 DROP CONSTRAINT IF EXISTS messages_v2_conversation_id_conversations_v2_id_fk;
  EXCEPTION WHEN others THEN NULL;
  END;
  ALTER TABLE messages_v2 ADD CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations_v2(id) ON DELETE CASCADE NOT VALID;
  ALTER TABLE messages_v2 VALIDATE CONSTRAINT fk_messages_conversation;
END$$;

-- 6) Compliance & tracking tables (aligned with V2 multi-tenant model)

-- Email suppression (scoped per agent; same email can appear for different agents)
CREATE TABLE IF NOT EXISTS email_suppression_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  suppression_type varchar(50) NOT NULL CHECK (suppression_type IN ('bounce', 'complaint', 'unsubscribe', 'manual')),
  reason text,
  agent_id uuid REFERENCES agents_v2(id) ON DELETE CASCADE,
  suppressed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_agent_email ON email_suppression_v2 (agent_id, email);
CREATE INDEX IF NOT EXISTS idx_suppression_agent_type ON email_suppression_v2 (agent_id, suppression_type);

-- Delivery events (FK to messages_v2.message_id via unique index)
CREATE TABLE IF NOT EXISTS delivery_events_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id varchar(255) NOT NULL,
  conversation_id uuid REFERENCES conversations_v2(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained')),
  "timestamp" timestamp NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT fk_delivery_events_message
    FOREIGN KEY (message_id) REFERENCES messages_v2(message_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_delivery_events_message ON delivery_events_v2 (message_id, event_type);
CREATE INDEX IF NOT EXISTS idx_delivery_events_conversation ON delivery_events_v2 (conversation_id, "timestamp");