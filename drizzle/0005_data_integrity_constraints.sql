-- Migration: 0005_data_integrity_constraints
-- Purpose: Add missing foreign key constraints and data validation rules
-- Safe to run multiple times with proper error handling

-- Add missing foreign key constraints with proper error handling
DO $$ BEGIN
    -- Ensure conversations.lead_id references leads.id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_lead_id_leads_id_fk'
        AND table_name = 'conversations'
    ) THEN
        -- First clean up any orphaned records
        UPDATE conversations 
        SET lead_id = NULL 
        WHERE lead_id IS NOT NULL 
        AND lead_id NOT IN (SELECT id FROM leads);
        
        ALTER TABLE conversations 
        ADD CONSTRAINT conversations_lead_id_leads_id_fk 
        FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add conversations.lead_id constraint: %', SQLERRM;
END $$;

-- Add unique constraints where appropriate
DO $$ BEGIN
    -- Ensure only one active AI agent config per client
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ai_agent_config_one_active_per_client'
        AND table_name = 'ai_agent_config'
    ) THEN
        -- First ensure data integrity by deactivating duplicates
        WITH ranked_configs AS (
            SELECT id, client_id, is_active,
                   ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY updated_at DESC) as rn
            FROM ai_agent_config 
            WHERE is_active = true
        )
        UPDATE ai_agent_config 
        SET is_active = false 
        WHERE id IN (
            SELECT id FROM ranked_configs WHERE rn > 1
        );
        
        CREATE UNIQUE INDEX CONCURRENTLY ai_agent_config_one_active_per_client
        ON ai_agent_config(client_id) WHERE is_active = true;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add unique active AI config constraint: %', SQLERRM;
END $$;

-- Add check constraints for data validation
DO $$ BEGIN
    -- Email format validation for leads
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'leads_email_format_check'
    ) THEN
        ALTER TABLE leads 
        ADD CONSTRAINT leads_email_format_check 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add email format check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Valid status values for leads
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'leads_status_values_check'
    ) THEN
        ALTER TABLE leads 
        ADD CONSTRAINT leads_status_values_check 
        CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add lead status check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Valid status values for campaigns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'campaigns_status_values_check'
    ) THEN
        ALTER TABLE campaigns 
        ADD CONSTRAINT campaigns_status_values_check 
        CHECK (status IN ('draft', 'active', 'scheduled', 'completed', 'paused', 'sent'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add campaign status check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Valid status values for conversations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'conversations_status_values_check'
    ) THEN
        ALTER TABLE conversations 
        ADD CONSTRAINT conversations_status_values_check 
        CHECK (status IN ('active', 'closed', 'archived'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add conversation status check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Valid priority values for conversations
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'conversations_priority_values_check'
    ) THEN
        ALTER TABLE conversations 
        ADD CONSTRAINT conversations_priority_values_check 
        CHECK (priority IN ('high', 'normal', 'low'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add conversation priority check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Valid role values for users
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'users_role_values_check'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT users_role_values_check 
        CHECK (role IN ('admin', 'manager', 'user'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add user role check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Valid communication type values for campaigns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'campaigns_communication_type_check'
    ) THEN
        ALTER TABLE campaigns 
        ADD CONSTRAINT campaigns_communication_type_check 
        CHECK (communication_type IN ('email', 'sms', 'email_sms'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add communication type check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Valid schedule type values for campaigns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'campaigns_schedule_type_check'
    ) THEN
        ALTER TABLE campaigns 
        ADD CONSTRAINT campaigns_schedule_type_check 
        CHECK (schedule_type IN ('immediate', 'scheduled', 'recurring'));
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add schedule type check: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Positive values for template and message counts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'campaigns_positive_counts_check'
    ) THEN
        ALTER TABLE campaigns 
        ADD CONSTRAINT campaigns_positive_counts_check 
        CHECK (
            number_of_templates > 0 AND 
            days_between_messages >= 0 AND 
            (open_rate IS NULL OR (open_rate >= 0 AND open_rate <= 100))
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add positive counts check: %', SQLERRM;
END $$;

-- Add NOT NULL constraints for critical fields where missing
DO $$ BEGIN
    -- Ensure leads have required email field
    ALTER TABLE leads ALTER COLUMN email SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set leads.email as NOT NULL: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Ensure ai_agent_config has required name field
    ALTER TABLE ai_agent_config ALTER COLUMN name SET NOT NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set ai_agent_config.name as NOT NULL: %', SQLERRM;
END $$;

-- Add updated_at trigger for tables missing it
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

DO $$ BEGIN
    -- Add updated_at trigger for leads table
    DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
    CREATE TRIGGER update_leads_updated_at
        BEFORE UPDATE ON leads
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create leads updated_at trigger: %', SQLERRM;
END $$;

DO $$ BEGIN
    -- Add updated_at trigger for conversations table
    DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
    CREATE TRIGGER update_conversations_updated_at
        BEFORE UPDATE ON conversations
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create conversations updated_at trigger: %', SQLERRM;
END $$;

-- End of migration