-- Security and API Key Management Tables Migration
-- Created: 2025-08-20
-- Purpose: Add API key management and rate limiting infrastructure

-- API Keys table for external integrations and authentication
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "key_hash" varchar(255) NOT NULL UNIQUE,
  "key_prefix" varchar(8) NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "rate_limit_tier" varchar(20) DEFAULT 'standard',
  "client_id" uuid REFERENCES "clients"("id"),
  "user_id" varchar REFERENCES "users"("id"),
  "is_active" boolean DEFAULT true NOT NULL,
  "last_used" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS "rate_limit_attempts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "identifier" varchar(255) NOT NULL,
  "endpoint" varchar(255) NOT NULL,
  "attempts" integer DEFAULT 1 NOT NULL,
  "window_start" timestamp DEFAULT now() NOT NULL,
  "window_end" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_api_keys_key_hash" ON "api_keys" ("key_hash");
CREATE INDEX IF NOT EXISTS "idx_api_keys_client_id" ON "api_keys" ("client_id");
CREATE INDEX IF NOT EXISTS "idx_api_keys_user_id" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_api_keys_active" ON "api_keys" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_api_keys_expires_at" ON "api_keys" ("expires_at");

CREATE INDEX IF NOT EXISTS "idx_rate_limit_identifier" ON "rate_limit_attempts" ("identifier");
CREATE INDEX IF NOT EXISTS "idx_rate_limit_endpoint" ON "rate_limit_attempts" ("endpoint");
CREATE INDEX IF NOT EXISTS "idx_rate_limit_window" ON "rate_limit_attempts" ("window_start", "window_end");

-- Composite index for rate limit queries
CREATE INDEX IF NOT EXISTS "idx_rate_limit_lookup" ON "rate_limit_attempts" ("identifier", "endpoint", "window_start", "window_end");

-- Add function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for api_keys table
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE "api_keys" IS 'API keys for external integrations and authenticated access';
COMMENT ON TABLE "rate_limit_attempts" IS 'Tracking table for rate limiting per identifier and endpoint';
COMMENT ON COLUMN "api_keys"."key_hash" IS 'bcrypt hashed API key for secure storage';
COMMENT ON COLUMN "api_keys"."key_prefix" IS 'First 8 characters of key for identification (e.g., mk_live_)';
COMMENT ON COLUMN "api_keys"."permissions" IS 'JSON array of allowed permissions/scopes';
COMMENT ON COLUMN "api_keys"."rate_limit_tier" IS 'Rate limiting tier: standard, premium, enterprise';
COMMENT ON COLUMN "rate_limit_attempts"."identifier" IS 'IP address, API key hash, or user ID for rate limiting';
COMMENT ON COLUMN "rate_limit_attempts"."endpoint" IS 'API endpoint path for granular rate limiting';