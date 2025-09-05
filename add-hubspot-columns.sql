-- ========================================
-- ADD HUBSPOT INTEGRATION COLUMNS
-- ========================================
-- Adds columns to track HubSpot synchronization via Zapier

BEGIN;

-- Add HubSpot tracking columns to handover_events table
ALTER TABLE handover_events 
  ADD COLUMN IF NOT EXISTS synced_to_hubspot BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hubspot_sync_status VARCHAR(50) DEFAULT NULL, -- 'success', 'failed', 'completed'
  ADD COLUMN IF NOT EXISTS hubspot_sync_date TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hubspot_deal_id VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hubspot_sync_error TEXT DEFAULT NULL;

-- Add HubSpot contact ID to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS hubspot_contact_id VARCHAR(255) DEFAULT NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_handover_events_hubspot_sync ON handover_events(synced_to_hubspot, hubspot_sync_status);
CREATE INDEX IF NOT EXISTS idx_handover_events_hubspot_ids ON handover_events(hubspot_contact_id, hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_leads_hubspot_contact ON leads(hubspot_contact_id);

-- Add comments for documentation
COMMENT ON COLUMN handover_events.synced_to_hubspot IS 'Whether this handover has been sent to HubSpot via Zapier';
COMMENT ON COLUMN handover_events.hubspot_sync_status IS 'Current sync status: success, failed, or completed';
COMMENT ON COLUMN handover_events.hubspot_sync_date IS 'When the handover was synced to HubSpot';
COMMENT ON COLUMN handover_events.hubspot_contact_id IS 'HubSpot Contact ID after successful sync';
COMMENT ON COLUMN handover_events.hubspot_deal_id IS 'HubSpot Deal ID after successful sync';
COMMENT ON COLUMN handover_events.hubspot_sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN leads.hubspot_contact_id IS 'HubSpot Contact ID for this lead';

COMMIT;

-- Verify columns were added
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'handover_events' 
  AND column_name LIKE 'hubspot%'
ORDER BY ordinal_position;