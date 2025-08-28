-- Fix campaign_knowledge_bases table to use correct UUID reference
DO $$
BEGIN
    -- First, let's alter the column type to UUID
    ALTER TABLE campaign_knowledge_bases ALTER COLUMN knowledge_base_id TYPE uuid USING knowledge_base_id::uuid;
    
    -- Then add foreign key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_campaign_knowledge_bases_kb_id') THEN
        ALTER TABLE campaign_knowledge_bases ADD CONSTRAINT fk_campaign_knowledge_bases_kb_id FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE;
    END IF;
    
    -- Add campaign foreign key constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_campaign_knowledge_bases_campaign_id') THEN
        ALTER TABLE campaign_knowledge_bases ADD CONSTRAINT fk_campaign_knowledge_bases_campaign_id FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If the UUID conversion fails, it means we need to handle existing data differently
        RAISE NOTICE 'Could not convert knowledge_base_id to UUID type. Table might have existing data with incompatible values.';
END $$;