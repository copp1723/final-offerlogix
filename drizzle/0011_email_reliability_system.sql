-- Email Reliability System Migration
-- Adds comprehensive email queue, delivery tracking, suppression, and domain health tables

-- Email Queue Table for tracking all outbound emails
CREATE TABLE IF NOT EXISTS "email_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar UNIQUE,
	"to" varchar NOT NULL,
	"from" varchar NOT NULL,
	"subject" text NOT NULL,
	"html" text,
	"text" text,
	"campaign_id" varchar,
	"lead_id" varchar,
	"status" varchar DEFAULT 'pending',
	"priority" integer DEFAULT 0,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"scheduled_for" timestamp,
	"last_attempt_at" timestamp,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Email Delivery Events Table for tracking email lifecycle events
CREATE TABLE IF NOT EXISTS "email_delivery_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_queue_id" varchar,
	"message_id" varchar,
	"event_type" varchar NOT NULL,
	"timestamp" timestamp NOT NULL,
	"recipient_email" varchar NOT NULL,
	"campaign_id" varchar,
	"lead_id" varchar,
	"user_agent" text,
	"client_name" text,
	"client_os" text,
	"device_type" text,
	"url" text,
	"ip" varchar,
	"city" varchar,
	"region" varchar,
	"country" varchar,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Email Suppression List for bounce/complaint/unsubscribe management
CREATE TABLE IF NOT EXISTS "email_suppression_list" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL UNIQUE,
	"suppression_type" varchar NOT NULL,
	"reason" text,
	"bounce_type" varchar,
	"campaign_id" varchar,
	"lead_id" varchar,
	"suppressed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Domain Health Table for monitoring sender domain reputation
CREATE TABLE IF NOT EXISTS "domain_health" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar NOT NULL,
	"spf_record" text,
	"spf_valid" boolean,
	"dkim_valid" boolean,
	"dmarc_record" text,
	"dmarc_valid" boolean,
	"reputation_score" integer,
	"last_checked" timestamp DEFAULT now() NOT NULL,
	"sent_last_24h" integer DEFAULT 0,
	"delivered_last_24h" integer DEFAULT 0,
	"bounced_last_24h" integer DEFAULT 0,
	"complaints_last_24h" integer DEFAULT 0,
	"delivery_rate" integer,
	"bounce_rate" integer,
	"complaint_rate" integer,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Campaign Delivery Metrics Table for aggregated campaign performance
CREATE TABLE IF NOT EXISTS "campaign_delivery_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar,
	"date" timestamp NOT NULL,
	"emails_sent" integer DEFAULT 0,
	"emails_delivered" integer DEFAULT 0,
	"emails_bounced" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"emails_unsubscribed" integer DEFAULT 0,
	"emails_complained" integer DEFAULT 0,
	"delivery_rate" integer,
	"open_rate" integer,
	"click_rate" integer,
	"bounce_rate" integer,
	"complaint_rate" integer,
	"unsubscribe_rate" integer,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add Foreign Key Constraints
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
		ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "email_delivery_events" ADD CONSTRAINT "email_delivery_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "email_suppression_list" ADD CONSTRAINT "email_suppression_list_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "campaign_delivery_metrics" ADD CONSTRAINT "campaign_delivery_metrics_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
		ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "email_delivery_events" ADD CONSTRAINT "email_delivery_events_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "email_suppression_list" ADD CONSTRAINT "email_suppression_list_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
		ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "email_delivery_events" ADD CONSTRAINT "email_delivery_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "email_suppression_list" ADD CONSTRAINT "email_suppression_list_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "domain_health" ADD CONSTRAINT "domain_health_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
		ALTER TABLE "campaign_delivery_metrics" ADD CONSTRAINT "campaign_delivery_metrics_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE no action ON UPDATE no action;
	END IF;
	
	-- Add email_queue self-reference
	ALTER TABLE "email_delivery_events" ADD CONSTRAINT "email_delivery_events_email_queue_id_email_queue_id_fk" FOREIGN KEY ("email_queue_id") REFERENCES "email_queue"("id") ON DELETE no action ON UPDATE no action;
END $$;

-- Create Performance Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_queue_status" ON "email_queue" ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_queue_scheduled_for" ON "email_queue" ("scheduled_for");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_queue_campaign_id" ON "email_queue" ("campaign_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_queue_client_id" ON "email_queue" ("client_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_queue_created_at" ON "email_queue" ("created_at");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_queue_priority_status" ON "email_queue" ("priority", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_delivery_events_event_type" ON "email_delivery_events" ("event_type");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_delivery_events_recipient_email" ON "email_delivery_events" ("recipient_email");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_delivery_events_timestamp" ON "email_delivery_events" ("timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_delivery_events_campaign_id" ON "email_delivery_events" ("campaign_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_delivery_events_message_id" ON "email_delivery_events" ("message_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_suppression_list_email" ON "email_suppression_list" ("email");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_suppression_list_suppression_type" ON "email_suppression_list" ("suppression_type");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_email_suppression_list_expires_at" ON "email_suppression_list" ("expires_at");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_domain_health_domain" ON "domain_health" ("domain");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_domain_health_last_checked" ON "domain_health" ("last_checked");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_campaign_delivery_metrics_campaign_id" ON "campaign_delivery_metrics" ("campaign_id");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_campaign_delivery_metrics_date" ON "campaign_delivery_metrics" ("date");

-- Add trigger to automatically update email_queue.updated_at
CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_queue_updated_at_trigger ON email_queue;
CREATE TRIGGER update_email_queue_updated_at_trigger
    BEFORE UPDATE ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_email_queue_updated_at();

-- Add trigger to automatically update domain_health.updated_at
CREATE OR REPLACE FUNCTION update_domain_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_domain_health_updated_at_trigger ON domain_health;
CREATE TRIGGER update_domain_health_updated_at_trigger
    BEFORE UPDATE ON domain_health
    FOR EACH ROW
    EXECUTE FUNCTION update_domain_health_updated_at();

-- Grant permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_role;

COMMENT ON TABLE email_queue IS 'Queue for tracking all outbound emails with retry logic and delivery status';
COMMENT ON TABLE email_delivery_events IS 'Log of email delivery events from Mailgun webhooks (delivered, opened, clicked, bounced, etc.)';
COMMENT ON TABLE email_suppression_list IS 'List of email addresses that should not receive emails due to bounces, complaints, or unsubscribes';
COMMENT ON TABLE domain_health IS 'Domain reputation monitoring and DNS record validation tracking';
COMMENT ON TABLE campaign_delivery_metrics IS 'Daily aggregated metrics for campaign email delivery performance';