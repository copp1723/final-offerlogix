-- Migration: 0006_security_improvements
-- Purpose: Implement security best practices and data protection measures
-- Safe to run multiple times with proper error handling

-- Add row-level security (RLS) policies for multi-tenant data isolation
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_config ENABLE ROW LEVEL SECURITY;

-- Create security context function to get current client_id
CREATE OR REPLACE FUNCTION get_current_client_id() 
RETURNS uuid AS $$
BEGIN
    -- This would typically get the client_id from session context
    -- For now, return a default value that applications can override
    RETURN COALESCE(
        current_setting('app.current_client_id', true)::uuid,
        (SELECT id FROM clients WHERE domain = 'localhost' LIMIT 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policy for campaigns - users can only see campaigns for their client
DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_campaigns ON campaigns;
    CREATE POLICY tenant_isolation_campaigns ON campaigns
        FOR ALL
        TO PUBLIC
        USING (client_id = get_current_client_id());
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create campaigns RLS policy: %', SQLERRM;
END $$;

-- RLS Policy for leads - users can only see leads for their client
DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_leads ON leads;
    CREATE POLICY tenant_isolation_leads ON leads
        FOR ALL
        TO PUBLIC
        USING (client_id = get_current_client_id());
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create leads RLS policy: %', SQLERRM;
END $$;

-- RLS Policy for conversations - through campaign relationship
DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_conversations ON conversations;
    CREATE POLICY tenant_isolation_conversations ON conversations
        FOR ALL
        TO PUBLIC
        USING (
            campaign_id IN (
                SELECT id FROM campaigns WHERE client_id = get_current_client_id()
            ) OR
            lead_id IN (
                SELECT id FROM leads WHERE client_id = get_current_client_id()
            )
        );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create conversations RLS policy: %', SQLERRM;
END $$;

-- RLS Policy for conversation messages - through conversation relationship
DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_conversation_messages ON conversation_messages;
    CREATE POLICY tenant_isolation_conversation_messages ON conversation_messages
        FOR ALL
        TO PUBLIC
        USING (
            conversation_id IN (
                SELECT c.id FROM conversations c
                JOIN campaigns camp ON c.campaign_id = camp.id
                WHERE camp.client_id = get_current_client_id()
                
                UNION
                
                SELECT c.id FROM conversations c
                JOIN leads l ON c.lead_id = l.id
                WHERE l.client_id = get_current_client_id()
            )
        );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create conversation_messages RLS policy: %', SQLERRM;
END $$;

-- RLS Policy for ai_agent_config - users can only see configs for their client
DO $$ BEGIN
    DROP POLICY IF EXISTS tenant_isolation_ai_agent_config ON ai_agent_config;
    CREATE POLICY tenant_isolation_ai_agent_config ON ai_agent_config
        FOR ALL
        TO PUBLIC
        USING (client_id = get_current_client_id());
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create ai_agent_config RLS policy: %', SQLERRM;
END $$;

-- Add audit logging table for security monitoring
CREATE TABLE IF NOT EXISTS security_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    operation text NOT NULL, -- INSERT, UPDATE, DELETE
    user_id text,
    client_id uuid,
    old_values jsonb,
    new_values jsonb,
    changed_at timestamp DEFAULT NOW() NOT NULL,
    ip_address inet,
    user_agent text
);

-- Index for audit log queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_table_operation ON security_audit_log(table_name, operation);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_client_id ON security_audit_log(client_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_changed_at ON security_audit_log(changed_at DESC);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_data jsonb;
    new_data jsonb;
    current_client_id uuid;
BEGIN
    -- Get current client context
    BEGIN
        current_client_id := get_current_client_id();
    EXCEPTION WHEN OTHERS THEN
        current_client_id := NULL;
    END;

    -- Prepare old and new data
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
    END IF;
    
    IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
        new_data := to_jsonb(NEW);
    END IF;

    -- Insert audit record
    INSERT INTO security_audit_log (
        table_name, 
        operation, 
        user_id, 
        client_id, 
        old_values, 
        new_values,
        changed_at
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        current_setting('app.current_user_id', true),
        current_client_id,
        old_data,
        new_data,
        NOW()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to sensitive tables
DO $$ BEGIN
    DROP TRIGGER IF EXISTS audit_campaigns ON campaigns;
    CREATE TRIGGER audit_campaigns
        AFTER INSERT OR UPDATE OR DELETE ON campaigns
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create campaigns audit trigger: %', SQLERRM;
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS audit_leads ON leads;
    CREATE TRIGGER audit_leads
        AFTER INSERT OR UPDATE OR DELETE ON leads
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create leads audit trigger: %', SQLERRM;
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS audit_users ON users;
    CREATE TRIGGER audit_users
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create users audit trigger: %', SQLERRM;
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS audit_ai_agent_config ON ai_agent_config;
    CREATE TRIGGER audit_ai_agent_config
        AFTER INSERT OR UPDATE OR DELETE ON ai_agent_config
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create ai_agent_config audit trigger: %', SQLERRM;
END $$;

-- Add data retention policy for audit logs (keep 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM security_audit_log 
    WHERE changed_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Add sensitive data encryption for passwords (if not already using proper hashing)
-- This is a reminder that passwords should be properly hashed using bcrypt or similar

-- Create function to validate and sanitize email addresses
CREATE OR REPLACE FUNCTION clean_email(input_email text)
RETURNS text AS $$
BEGIN
    -- Convert to lowercase and trim
    input_email := LOWER(TRIM(input_email));
    
    -- Basic email validation
    IF input_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format: %', input_email;
    END IF;
    
    -- Remove potential security risks
    input_email := REPLACE(input_email, '''', '');
    input_email := REPLACE(input_email, '"', '');
    input_email := REPLACE(input_email, '<', '');
    input_email := REPLACE(input_email, '>', '');
    
    RETURN input_email;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to automatically clean email addresses
CREATE OR REPLACE FUNCTION clean_email_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.email := clean_email(NEW.email);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS clean_leads_email ON leads;
    CREATE TRIGGER clean_leads_email
        BEFORE INSERT OR UPDATE ON leads
        FOR EACH ROW EXECUTE FUNCTION clean_email_trigger();
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create email cleaning trigger: %', SQLERRM;
END $$;

-- Add indexes for security audit queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_security_audit_sensitive_operations 
ON security_audit_log(table_name, operation, changed_at DESC) 
WHERE operation IN ('DELETE', 'UPDATE');

-- End of migration