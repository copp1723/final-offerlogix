CREATE TABLE "ai_agent_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"tonality" text DEFAULT 'professional' NOT NULL,
	"personality" text,
	"dos_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"donts_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"industry" varchar DEFAULT 'automotive',
	"response_style" text DEFAULT 'helpful',
	"model" text DEFAULT 'openai/gpt-5-chat',
	"system_prompt" text,
	"agent_email_domain" varchar,
	"is_active" boolean DEFAULT false NOT NULL,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_knowledge_bases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar,
	"knowledge_base_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"context" text NOT NULL,
	"handover_goals" text,
	"target_audience" text,
	"handover_prompt" text,
	"handover_prompt_spec" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"templates" jsonb,
	"subject_lines" jsonb,
	"number_of_templates" integer DEFAULT 5,
	"days_between_messages" integer DEFAULT 3,
	"open_rate" integer,
	"is_template" boolean DEFAULT false,
	"original_campaign_id" varchar,
	"communication_type" varchar(20) DEFAULT 'email',
	"sms_opt_in_required" boolean DEFAULT true,
	"sms_opt_in_message" text DEFAULT 'Would you like to continue this conversation via text? Reply YES to receive SMS updates.',
	"schedule_type" varchar(20) DEFAULT 'immediate',
	"scheduled_start" timestamp,
	"recurring_pattern" varchar(50),
	"recurring_days" jsonb,
	"recurring_time" varchar(8),
	"is_active" boolean DEFAULT true,
	"next_execution" timestamp,
	"agent_config_id" varchar,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"domain" varchar(255),
	"branding_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar,
	"sender_id" varchar,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"is_from_ai" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar,
	"lead_id" varchar,
	"user_id" varchar,
	"subject" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_document_chunks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"start_index" integer,
	"end_index" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_documents" (
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
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"client_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"phone" varchar,
	"vehicle_interest" varchar,
	"lead_source" varchar,
	"status" varchar DEFAULT 'new',
	"tags" varchar[],
	"notes" text,
	"campaign_id" varchar,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"email" text,
	"notification_preferences" jsonb DEFAULT '{
    "emailNotifications": true,
    "campaignAlerts": true,
    "leadAlerts": true,
    "systemAlerts": true,
    "monthlyReports": true,
    "highEngagementAlerts": true,
    "quotaWarnings": true
  }'::jsonb NOT NULL,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "ai_agent_config" ADD CONSTRAINT "ai_agent_config_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_knowledge_bases" ADD CONSTRAINT "campaign_knowledge_bases_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_knowledge_bases" ADD CONSTRAINT "campaign_knowledge_bases_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_agent_config_id_ai_agent_config_id_fk" FOREIGN KEY ("agent_config_id") REFERENCES "public"."ai_agent_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_document_chunks" ADD CONSTRAINT "kb_document_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;