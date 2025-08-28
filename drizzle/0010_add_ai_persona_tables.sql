-- Add AI Personas table for multi-persona agent system
CREATE TABLE IF NOT EXISTS "ai_personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"target_audience" varchar(255),
	"industry" varchar(100) DEFAULT 'automotive',
	"tonality" text DEFAULT 'professional' NOT NULL,
	"personality" text,
	"communication_style" text DEFAULT 'helpful',
	"model" text DEFAULT 'openai/gpt-4o',
	"temperature" integer DEFAULT 70,
	"max_tokens" integer DEFAULT 300,
	"system_prompt" text,
	"response_guidelines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"escalation_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_channels" jsonb DEFAULT '["email"]'::jsonb NOT NULL,
	"handover_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kb_access_level" varchar(50) DEFAULT 'campaign_only',
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 100,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraint to clients table
DO $$ BEGIN
 ALTER TABLE "ai_personas" ADD CONSTRAINT "ai_personas_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Junction table for personas to knowledge bases
CREATE TABLE IF NOT EXISTS "persona_knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"persona_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"access_level" varchar(50) DEFAULT 'read',
	"priority" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "persona_knowledge_bases" ADD CONSTRAINT "persona_knowledge_bases_persona_id_ai_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "ai_personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "persona_knowledge_bases" ADD CONSTRAINT "persona_knowledge_bases_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "knowledge_bases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- KB documents persona tags table
CREATE TABLE IF NOT EXISTS "kb_document_persona_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"relevance_score" integer DEFAULT 100,
	"tags" varchar[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "kb_document_persona_tags" ADD CONSTRAINT "kb_document_persona_tags_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "kb_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "kb_document_persona_tags" ADD CONSTRAINT "kb_document_persona_tags_persona_id_ai_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "ai_personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Add persona_id column to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "persona_id" uuid;

-- Add foreign key constraint for campaign persona
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_persona_id_ai_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "ai_personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_ai_personas_client_id" ON "ai_personas" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_ai_personas_target_audience" ON "ai_personas" ("target_audience");
CREATE INDEX IF NOT EXISTS "idx_ai_personas_active" ON "ai_personas" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_ai_personas_default" ON "ai_personas" ("is_default");
CREATE INDEX IF NOT EXISTS "idx_persona_knowledge_bases_persona_id" ON "persona_knowledge_bases" ("persona_id");
CREATE INDEX IF NOT EXISTS "idx_persona_knowledge_bases_kb_id" ON "persona_knowledge_bases" ("knowledge_base_id");
CREATE INDEX IF NOT EXISTS "idx_kb_document_persona_tags_document_id" ON "kb_document_persona_tags" ("document_id");
CREATE INDEX IF NOT EXISTS "idx_kb_document_persona_tags_persona_id" ON "kb_document_persona_tags" ("persona_id");
CREATE INDEX IF NOT EXISTS "idx_campaigns_persona_id" ON "campaigns" ("persona_id");