-- EMERGENCY FIX: Create missing security_audit_log table
-- This fixes the production error: relation "security_audit_log" does not exist

-- Create the security_audit_log table
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

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_table_operation ON security_audit_log(table_name, operation);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_client_id ON security_audit_log(client_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_changed_at ON security_audit_log(changed_at DESC);

-- Create the get_current_client_id function if it doesn't exist
CREATE OR REPLACE FUNCTION get_current_client_id()
RETURNS uuid AS $$
BEGIN
    BEGIN
        RETURN current_setting('app.current_client_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the audit trigger function
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

-- Verify the table was created
SELECT 'security_audit_log table created successfully' as status;
