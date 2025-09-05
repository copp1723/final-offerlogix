-- SQL Migration: Fix Missing Columns and Tables
-- Fixes production database errors for OfferLogix B2B sales platform
-- Migration is idempotent and can be run multiple times safely

BEGIN;

-- 1. Add missing 'from_name' column to ai_agent_config table
-- Used for dedicated email From: display name (e.g., "Riley Donovan")
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_agent_config' 
        AND column_name = 'from_name'
    ) THEN
        ALTER TABLE ai_agent_config 
        ADD COLUMN from_name TEXT;
        
        COMMENT ON COLUMN ai_agent_config.from_name IS 'Dedicated email From: display name (e.g., "Riley Donovan")';
    END IF;
END $$;

-- 2. Add missing 'product_interest' column to leads table  
-- Used for OfferLogix products/solutions the lead is interested in
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' 
        AND column_name = 'product_interest'
    ) THEN
        ALTER TABLE leads 
        ADD COLUMN product_interest VARCHAR;
        
        COMMENT ON COLUMN leads.product_interest IS 'OfferLogix products/solutions the lead is interested in';
    END IF;
END $$;

-- 3. Add missing 'handover_criteria' column to campaigns table
-- Used for intent-based handover triggers stored as JSONB
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'campaigns' 
        AND column_name = 'handover_criteria'
    ) THEN
        ALTER TABLE campaigns 
        ADD COLUMN handover_criteria JSONB;
        
        COMMENT ON COLUMN campaigns.handover_criteria IS 'Intent-based handover triggers stored as JSONB';
    END IF;
END $$;

-- 4. Create missing 'security_events' table
-- Used for security monitoring and alerting
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'security_events'
    ) THEN
        CREATE TABLE security_events (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(100) NOT NULL,
            severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
            message TEXT NOT NULL,
            source VARCHAR(100) NOT NULL, -- IP address, user agent, etc.
            metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
            client_id UUID REFERENCES clients(id),
            user_id VARCHAR REFERENCES users(id),
            timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
            created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        
        -- Add indexes for performance
        CREATE INDEX idx_security_events_event_type ON security_events(event_type);
        CREATE INDEX idx_security_events_severity ON security_events(severity);
        CREATE INDEX idx_security_events_client_id ON security_events(client_id);
        CREATE INDEX idx_security_events_user_id ON security_events(user_id);
        CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
        CREATE INDEX idx_security_events_created_at ON security_events(created_at);
        
        -- Add table comment
        COMMENT ON TABLE security_events IS 'Security events table for monitoring and alerting';
        COMMENT ON COLUMN security_events.event_type IS 'Type of security event (e.g., failed_login, suspicious_activity)';
        COMMENT ON COLUMN security_events.severity IS 'Severity level: low, medium, high, critical';
        COMMENT ON COLUMN security_events.message IS 'Human-readable description of the security event';
        COMMENT ON COLUMN security_events.source IS 'Source of the event (IP address, user agent, etc.)';
        COMMENT ON COLUMN security_events.metadata IS 'Additional event metadata stored as JSON';
        COMMENT ON COLUMN security_events.client_id IS 'Associated client ID for multi-tenant scoping';
        COMMENT ON COLUMN security_events.user_id IS 'Associated user ID if applicable';
        COMMENT ON COLUMN security_events.timestamp IS 'When the security event occurred';
        COMMENT ON COLUMN security_events.created_at IS 'When the record was created in the database';
    END IF;
END $$;

-- 5. Verify all expected indexes exist and create any missing ones

-- Ensure ai_agent_config has proper indexes
DO $$ 
BEGIN 
    -- Index on client_id for multi-tenant queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'ai_agent_config' 
        AND indexname = 'idx_ai_agent_config_client_id'
    ) THEN
        CREATE INDEX idx_ai_agent_config_client_id ON ai_agent_config(client_id);
    END IF;
    
    -- Index on is_active for filtering active configurations
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'ai_agent_config' 
        AND indexname = 'idx_ai_agent_config_is_active'
    ) THEN
        CREATE INDEX idx_ai_agent_config_is_active ON ai_agent_config(is_active);
    END IF;
END $$;

-- Ensure leads has proper indexes  
DO $$ 
BEGIN 
    -- Index on campaign_id for campaign-related queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'leads' 
        AND indexname = 'idx_leads_campaign_id'
    ) THEN
        CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
    END IF;
    
    -- Index on client_id for multi-tenant queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'leads' 
        AND indexname = 'idx_leads_client_id'
    ) THEN
        CREATE INDEX idx_leads_client_id ON leads(client_id);
    END IF;
    
    -- Index on email for lead lookups
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'leads' 
        AND indexname = 'idx_leads_email'
    ) THEN
        CREATE INDEX idx_leads_email ON leads(email);
    END IF;
    
    -- Index on status for filtering by lead status
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'leads' 
        AND indexname = 'idx_leads_status'
    ) THEN
        CREATE INDEX idx_leads_status ON leads(status);
    END IF;
END $$;

-- Ensure campaigns has proper indexes
DO $$ 
BEGIN 
    -- Index on client_id for multi-tenant queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'campaigns' 
        AND indexname = 'idx_campaigns_client_id'
    ) THEN
        CREATE INDEX idx_campaigns_client_id ON campaigns(client_id);
    END IF;
    
    -- Index on status for filtering campaigns by status
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'campaigns' 
        AND indexname = 'idx_campaigns_status'
    ) THEN
        CREATE INDEX idx_campaigns_status ON campaigns(status);
    END IF;
    
    -- Index on agent_config_id for agent-related queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'campaigns' 
        AND indexname = 'idx_campaigns_agent_config_id'
    ) THEN
        CREATE INDEX idx_campaigns_agent_config_id ON campaigns(agent_config_id);
    END IF;
END $$;

-- 6. Update any existing data if needed (optional data migrations)

-- Set default values for new columns where appropriate
-- Note: These are safe operations that won't overwrite existing data

-- Set default handover_criteria for campaigns that don't have it
UPDATE campaigns 
SET handover_criteria = '{}'::jsonb 
WHERE handover_criteria IS NULL;

-- Log the completion of the migration
DO $$ 
BEGIN 
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE '- Added from_name column to ai_agent_config table';
    RAISE NOTICE '- Added product_interest column to leads table'; 
    RAISE NOTICE '- Added handover_criteria column to campaigns table';
    RAISE NOTICE '- Created security_events table with proper indexes';
    RAISE NOTICE '- Ensured all necessary indexes exist for performance';
    RAISE NOTICE '- Updated existing campaigns with default handover_criteria';
END $$;

COMMIT;

-- Verification queries (optional - uncomment to run verification)
/*
-- Verify the migration was successful
SELECT 'ai_agent_config.from_name' as fix, 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'ai_agent_config' AND column_name = 'from_name'
       ) THEN 'FIXED' ELSE 'MISSING' END as status
UNION ALL
SELECT 'leads.product_interest' as fix,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'leads' AND column_name = 'product_interest'
       ) THEN 'FIXED' ELSE 'MISSING' END as status
UNION ALL  
SELECT 'campaigns.handover_criteria' as fix,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'campaigns' AND column_name = 'handover_criteria'
       ) THEN 'FIXED' ELSE 'MISSING' END as status
UNION ALL
SELECT 'security_events table' as fix,
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.tables 
           WHERE table_name = 'security_events'
       ) THEN 'FIXED' ELSE 'MISSING' END as status;
*/