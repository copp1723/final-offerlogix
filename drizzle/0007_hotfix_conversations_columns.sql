-- Hotfix: Ensure conversations table has all required columns
-- This addresses missing user_id and lead_id columns that weren't applied during previous migrations

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='conversations' AND column_name='user_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN user_id varchar;
        RAISE NOTICE 'Added user_id column to conversations table';
    ELSE
        RAISE NOTICE 'user_id column already exists in conversations table';
    END IF;
END $$;

-- Add lead_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='conversations' AND column_name='lead_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN lead_id varchar;
        RAISE NOTICE 'Added lead_id column to conversations table';
    ELSE
        RAISE NOTICE 'lead_id column already exists in conversations table';
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add user_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_user_id_users_id_fk'
    ) THEN
        ALTER TABLE conversations ADD CONSTRAINT conversations_user_id_users_id_fk 
        FOREIGN KEY (user_id) REFERENCES users(id);
        RAISE NOTICE 'Added user_id foreign key constraint';
    END IF;
    
    -- Add lead_id foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'conversations_lead_id_leads_id_fk'
    ) THEN
        ALTER TABLE conversations ADD CONSTRAINT conversations_lead_id_leads_id_fk 
        FOREIGN KEY (lead_id) REFERENCES leads(id);
        RAISE NOTICE 'Added lead_id foreign key constraint';
    END IF;
END $$;