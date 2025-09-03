-- MailMind V2 Initial Schema Migration
-- Creates tables for minimal email conversation system

-- System prompts for global AI configuration
CREATE TABLE "system_prompts_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "prompt" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "is_global" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Agents: core entity for email addressing and AI configuration
CREATE TABLE "agents_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "domain" varchar(255) NOT NULL,
  "local_part" varchar(64) NOT NULL,
  "system_prompt_id" uuid NOT NULL REFERENCES "system_prompts_v2"("id"),
  "variables" jsonb NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT "agents_v2_client_id_domain_unique" UNIQUE ("client_id", "domain"),
  CONSTRAINT "valid_local_part" CHECK (local_part ~ '^[a-zA-Z0-9._-]+$' AND length(local_part) <= 64)
);

-- Indexes for agents
CREATE INDEX "agents_v2_client_id_idx" ON "agents_v2" ("client_id");
CREATE INDEX "agents_v2_domain_idx" ON "agents_v2" ("domain");
CREATE INDEX "agents_v2_active_idx" ON "agents_v2" ("is_active");

-- Campaigns: simple email campaign definitions
CREATE TABLE "campaigns_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents_v2"("id"),
  "name" varchar(255) NOT NULL,
  "template" text NOT NULL,
  "subject" varchar(255) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'draft',
  "send_window" jsonb,
  "total_sent" integer NOT NULL DEFAULT 0,
  "total_responses" integer NOT NULL DEFAULT 0,
  "total_handovers" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT "valid_status" CHECK (status IN ('draft', 'active', 'paused', 'completed'))
);

-- Indexes for campaigns
CREATE INDEX "campaigns_v2_agent_id_idx" ON "campaigns_v2" ("agent_id");
CREATE INDEX "campaigns_v2_status_idx" ON "campaigns_v2" ("status");

-- Leads: email tracking per campaign
CREATE TABLE "leads_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(320) NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns_v2"("id"),
  "agent_id" uuid NOT NULL REFERENCES "agents_v2"("id"),
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "last_activity_at" timestamp,
  "first_name" varchar(100),
  "last_name" varchar(100),
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT "leads_v2_campaign_id_email_unique" UNIQUE ("campaign_id", "email"),
  CONSTRAINT "valid_lead_status" CHECK (status IN ('active', 'responded', 'handed_over', 'unsubscribed')),
  CONSTRAINT "valid_email" CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Indexes for leads
CREATE INDEX "leads_v2_campaign_email_idx" ON "leads_v2" ("campaign_id", "email");
CREATE INDEX "leads_v2_agent_id_idx" ON "leads_v2" ("agent_id");
CREATE INDEX "leads_v2_status_idx" ON "leads_v2" ("status");

-- Conversations: email thread state management
CREATE TABLE "conversations_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" uuid NOT NULL REFERENCES "agents_v2"("id"),
  "lead_email" varchar(320) NOT NULL,
  "thread_id" varchar(255) NOT NULL,
  "last_message_id" varchar(255),
  "subject" varchar(255) NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'active',
  "message_count" integer NOT NULL DEFAULT 0,
  "handover_reason" text,
  "handover_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT "conversations_v2_agent_id_lead_email_thread_id_unique" UNIQUE ("agent_id", "lead_email", "thread_id"),
  CONSTRAINT "valid_conversation_status" CHECK (status IN ('active', 'handed_over', 'archived'))
);

-- Critical indexes for conversations
CREATE INDEX "conversations_v2_routing_idx" ON "conversations_v2" ("agent_id", "lead_email");
CREATE INDEX "conversations_v2_thread_idx" ON "conversations_v2" ("thread_id");
CREATE INDEX "conversations_v2_status_idx" ON "conversations_v2" ("status");

-- Messages: individual messages with email threading
CREATE TABLE "messages_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "conversations_v2"("id"),
  "content" text NOT NULL,
  "sender" varchar(10) NOT NULL,
  "message_id" varchar(255) NOT NULL,
  "in_reply_to" varchar(255),
  "is_handover_message" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT "valid_sender" CHECK (sender IN ('agent', 'lead')),
  CONSTRAINT "messages_v2_message_id_unique" UNIQUE ("message_id")
);

-- Critical indexes for messages
CREATE INDEX "messages_v2_conversation_time_idx" ON "messages_v2" ("conversation_id", "created_at");
CREATE INDEX "messages_v2_message_id_idx" ON "messages_v2" ("message_id");
CREATE INDEX "messages_v2_in_reply_to_idx" ON "messages_v2" ("in_reply_to");

-- Update timestamps trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_system_prompts_v2_updated_at BEFORE UPDATE ON "system_prompts_v2"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_v2_updated_at BEFORE UPDATE ON "agents_v2"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_v2_updated_at BEFORE UPDATE ON "campaigns_v2"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_v2_updated_at BEFORE UPDATE ON "leads_v2"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_v2_updated_at BEFORE UPDATE ON "conversations_v2"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();