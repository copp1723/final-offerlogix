-- Create knowledge base tables only
CREATE TABLE IF NOT EXISTS "knowledge_base" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"client_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kb_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"url" text,
	"document_type" varchar(50) DEFAULT 'note',
	"status" varchar(20) DEFAULT 'queued',
	"supermemory_id" varchar,
	"supermemory_status" varchar(20),
	"tags" varchar[] DEFAULT '{}',
	"container_tags" varchar[] DEFAULT '{}',
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"knowledge_base_id" varchar,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kb_document_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"start_index" integer,
	"end_index" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "campaign_knowledge_bases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar,
	"knowledge_base_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign keys if tables exist
DO $$
BEGIN
    -- knowledge_base foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        ALTER TABLE "knowledge_base" ADD CONSTRAINT IF NOT EXISTS "knowledge_base_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    -- kb_documents foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_base') THEN
        ALTER TABLE "kb_documents" ADD CONSTRAINT IF NOT EXISTS "kb_documents_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
        ALTER TABLE "kb_documents" ADD CONSTRAINT IF NOT EXISTS "kb_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    -- kb_document_chunks foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kb_documents') THEN
        ALTER TABLE "kb_document_chunks" ADD CONSTRAINT IF NOT EXISTS "kb_document_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    -- campaign_knowledge_bases foreign keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        ALTER TABLE "campaign_knowledge_bases" ADD CONSTRAINT IF NOT EXISTS "campaign_knowledge_bases_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'knowledge_base') THEN
        ALTER TABLE "campaign_knowledge_bases" ADD CONSTRAINT IF NOT EXISTS "campaign_knowledge_bases_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;