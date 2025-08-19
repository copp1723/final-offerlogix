-- Add foreign keys for knowledge base tables
DO $$
BEGIN
    -- knowledge_base foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'knowledge_base_client_id_clients_id_fk') THEN
        ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    -- kb_documents foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kb_documents_knowledge_base_id_knowledge_base_id_fk') THEN
        ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kb_documents_client_id_clients_id_fk') THEN
        ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    -- kb_document_chunks foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'kb_document_chunks_document_id_kb_documents_id_fk') THEN
        ALTER TABLE "kb_document_chunks" ADD CONSTRAINT "kb_document_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    -- campaign_knowledge_bases foreign keys
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_knowledge_bases_campaign_id_campaigns_id_fk') THEN
        ALTER TABLE "campaign_knowledge_bases" ADD CONSTRAINT "campaign_knowledge_bases_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_knowledge_bases_knowledge_base_id_knowledge_base_id_fk') THEN
        ALTER TABLE "campaign_knowledge_bases" ADD CONSTRAINT "campaign_knowledge_bases_knowledge_base_id_knowledge_base_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_base"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;