-- Add Supermemory integration columns to existing tables
DO $$
BEGIN
    -- Add supermemory_id column to kb_documents if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'supermemory_id') THEN
        ALTER TABLE kb_documents ADD COLUMN supermemory_id varchar;
    END IF;
    
    -- Add supermemory_status column to kb_documents if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'supermemory_status') THEN
        ALTER TABLE kb_documents ADD COLUMN supermemory_status varchar(20);
    END IF;
    
    -- Add container_tags column to kb_documents if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'kb_documents' AND column_name = 'container_tags') THEN
        ALTER TABLE kb_documents ADD COLUMN container_tags varchar[] DEFAULT '{}';
    END IF;
END $$;