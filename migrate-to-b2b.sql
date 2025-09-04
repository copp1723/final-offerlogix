-- ========================================
-- OFFERLOGIX B2B DATABASE MIGRATION
-- ========================================
-- Transforms database from B2C (dealers→customers) to B2B (OfferLogix→dealerships)
-- 
-- IMPORTANT: This migration renames columns and updates data to reflect:
-- - OLD: MailMind helped dealerships email customers about cars
-- - NEW: OfferLogix sells instant credit/financing solutions TO dealerships
--
-- Run with: psql $DATABASE_URL -f migrate-to-b2b.sql

BEGIN;

-- ========================================
-- STEP 1: RENAME COLUMNS IN LEADS TABLE
-- ========================================

-- Rename vehicleInterest to productInterest (dealerships interested in our products)
ALTER TABLE leads 
  RENAME COLUMN vehicle_interest TO product_interest;

-- Add new columns for B2B context
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS dealership_type VARCHAR(100), -- franchise, independent, buy-here-pay-here
  ADD COLUMN IF NOT EXISTS decision_maker_role VARCHAR(100), -- owner, finance_manager, gm
  ADD COLUMN IF NOT EXISTS annual_volume INTEGER, -- annual vehicle sales
  ADD COLUMN IF NOT EXISTS current_finance_provider VARCHAR(255);

-- Update column comments
COMMENT ON COLUMN leads.product_interest IS 'OfferLogix products/solutions the dealership is interested in';
COMMENT ON COLUMN leads.lead_source IS 'How the dealership contact was acquired (conference, cold_outreach, referral, demo_request)';
COMMENT ON COLUMN leads.status IS 'Dealership engagement status (new, contacted, demo_scheduled, negotiating, customer, lost)';
COMMENT ON COLUMN leads.company_name IS 'Dealership or automotive group name';
COMMENT ON COLUMN leads.dealership_type IS 'Type of dealership (franchise, independent, buy-here-pay-here)';
COMMENT ON COLUMN leads.decision_maker_role IS 'Role of the contact person at the dealership';

-- ========================================
-- STEP 2: UPDATE EXISTING DATA TO B2B CONTEXT
-- ========================================

-- Update lead sources to B2B sources
UPDATE leads 
SET lead_source = 
  CASE lead_source
    WHEN 'website' THEN 'demo_request'
    WHEN 'showroom' THEN 'conference'
    WHEN 'referral' THEN 'partner_referral'
    WHEN 'social' THEN 'linkedin_outreach'
    WHEN 'email' THEN 'cold_outreach'
    WHEN 'phone' THEN 'cold_call'
    WHEN 'chat' THEN 'website_chat'
    ELSE COALESCE(lead_source, 'unknown')
  END
WHERE lead_source IS NOT NULL;

-- Update lead statuses to B2B sales pipeline
UPDATE leads 
SET status = 
  CASE status
    WHEN 'new' THEN 'new'
    WHEN 'contacted' THEN 'contacted'
    WHEN 'qualified' THEN 'demo_scheduled'
    WHEN 'converted' THEN 'customer'
    WHEN 'lost' THEN 'not_interested'
    WHEN 'follow-up' THEN 'negotiating'
    ELSE COALESCE(status, 'new')
  END
WHERE status IS NOT NULL;

-- Update product interests from vehicles to OfferLogix products
UPDATE leads 
SET product_interest = 
  CASE 
    WHEN product_interest ILIKE '%sedan%' OR product_interest ILIKE '%suv%' OR product_interest ILIKE '%truck%' 
      THEN 'Instant Credit Platform'
    WHEN product_interest ILIKE '%hybrid%' OR product_interest ILIKE '%electric%' 
      THEN 'AI Financing Agents'
    WHEN product_interest ILIKE '%lease%' OR product_interest ILIKE '%finance%'
      THEN 'Credit Decision API'
    WHEN product_interest ILIKE '%new%' 
      THEN 'Full Platform Suite'
    WHEN product_interest ILIKE '%used%'
      THEN 'Subprime Financing Module'
    ELSE COALESCE(product_interest, 'Platform Demo')
  END
WHERE product_interest IS NOT NULL;

-- Generate company names for existing leads (if they don't have one)
UPDATE leads 
SET company_name = 
  CASE 
    WHEN company_name IS NULL OR company_name = '' THEN
      CONCAT(
        COALESCE(first_name, 'Auto'),
        ' ',
        CASE (random() * 4)::int
          WHEN 0 THEN 'Motors'
          WHEN 1 THEN 'Automotive Group'
          WHEN 2 THEN 'Auto Sales'
          WHEN 3 THEN 'Car Center'
          ELSE 'Dealership'
        END
      )
    ELSE company_name
  END;

-- Set dealership types for existing records
UPDATE leads 
SET dealership_type = 
  CASE (random() * 3)::int
    WHEN 0 THEN 'franchise'
    WHEN 1 THEN 'independent'
    WHEN 2 THEN 'buy-here-pay-here'
    ELSE 'independent'
  END
WHERE dealership_type IS NULL;

-- Set decision maker roles
UPDATE leads 
SET decision_maker_role = 
  CASE (random() * 4)::int
    WHEN 0 THEN 'owner'
    WHEN 1 THEN 'finance_manager'
    WHEN 2 THEN 'general_manager'
    WHEN 3 THEN 'sales_director'
    ELSE 'finance_manager'
  END
WHERE decision_maker_role IS NULL;

-- ========================================
-- STEP 3: UPDATE CAMPAIGNS TABLE
-- ========================================

-- Update campaign context for B2B
UPDATE campaigns 
SET context = 'Outreach campaign to automotive dealerships for OfferLogix instant credit solutions'
WHERE context ILIKE '%vehicle%' OR context ILIKE '%car%' OR context ILIKE '%customer%';

-- Update handover goals to reflect B2B sales process
UPDATE campaigns 
SET handover_goals = 'Qualify dealership for product demo and sales engagement'
WHERE handover_goals ILIKE '%test drive%' OR handover_goals ILIKE '%purchase%';

-- Update target audience
UPDATE campaigns 
SET target_audience = 'Automotive dealership decision makers - owners, finance managers, GMs'
WHERE target_audience ILIKE '%buyer%' OR target_audience ILIKE '%customer%' OR target_audience IS NULL;

-- ========================================
-- STEP 4: UPDATE AI AGENT CONFIGURATIONS
-- ========================================

-- Update AI agent configurations for B2B context
UPDATE ai_agent_config
SET 
  personality = 'Professional B2B sales specialist focused on dealership partnerships',
  industry = 'automotive_b2b',
  response_style = 'consultative'
WHERE industry = 'automotive';

-- Update dos and donts for B2B context
UPDATE ai_agent_config
SET 
  dos_list = jsonb_build_array(
    'Focus on ROI and business value',
    'Emphasize instant credit approval benefits',
    'Provide case studies and success metrics',
    'Schedule product demonstrations',
    'Discuss integration capabilities'
  ),
  donts_list = jsonb_build_array(
    'Avoid overly casual language',
    'Do not make unrealistic promises',
    'Avoid discussing competitor weaknesses',
    'Do not pressure for immediate decisions'
  )
WHERE dos_list IS NOT NULL OR donts_list IS NOT NULL;

-- ========================================
-- STEP 5: UPDATE CONVERSATION SUBJECTS
-- ========================================

UPDATE conversations 
SET subject = 
  CASE 
    WHEN subject ILIKE '%vehicle%' THEN REPLACE(subject, 'vehicle', 'financing solution')
    WHEN subject ILIKE '%car%' THEN REPLACE(subject, 'car', 'credit platform')
    WHEN subject ILIKE '%test drive%' THEN REPLACE(subject, 'test drive', 'product demo')
    ELSE subject
  END;

-- ========================================
-- STEP 6: CREATE B2B SPECIFIC INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_leads_company_name ON leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_dealership_type ON leads(dealership_type);
CREATE INDEX IF NOT EXISTS idx_leads_decision_maker_role ON leads(decision_maker_role);
CREATE INDEX IF NOT EXISTS idx_leads_product_interest ON leads(product_interest);

-- ========================================
-- STEP 7: UPDATE SAMPLE/SEED DATA
-- ========================================

-- Don't delete existing leads, just update them or add new ones

-- Insert B2B sample dealership data
INSERT INTO leads (
  email, first_name, last_name, phone, 
  product_interest, lead_source, status, 
  company_name, dealership_type, decision_maker_role,
  annual_volume, current_finance_provider, notes,
  created_at, updated_at
) VALUES
  ('jsmith@premierauto.com', 'John', 'Smith', '555-0100', 
   'Instant Credit Platform', 'conference', 'demo_scheduled',
   'Premier Auto Group', 'franchise', 'finance_manager',
   2400, 'RouteOne', 'Met at NADA conference, very interested in instant approvals',
   NOW() - INTERVAL '5 days', NOW()),
   
  ('mike@valleyautomall.com', 'Mike', 'Johnson', '555-0101',
   'AI Financing Agents', 'partner_referral', 'negotiating',
   'Valley Auto Mall', 'independent', 'owner',
   1200, 'DealerTrack', 'Referred by existing client, looking for AI automation',
   NOW() - INTERVAL '3 days', NOW()),
   
  ('sarah@luxuryimports.com', 'Sarah', 'Williams', '555-0102',
   'Full Platform Suite', 'demo_request', 'customer',
   'Luxury Imports', 'franchise', 'general_manager',
   3600, 'In-house', 'Signed up for full platform after successful pilot',
   NOW() - INTERVAL '30 days', NOW()),
   
  ('david@budgetcars.com', 'David', 'Brown', '555-0103',
   'Subprime Financing Module', 'cold_outreach', 'contacted',
   'Budget Cars Direct', 'buy-here-pay-here', 'owner',
   600, 'None', 'Specializes in subprime, needs better approval rates',
   NOW() - INTERVAL '2 days', NOW()),
   
  ('lisa@metroautogroup.com', 'Lisa', 'Davis', '555-0104',
   'Credit Decision API', 'linkedin_outreach', 'new',
   'Metro Auto Group', 'franchise', 'sales_director',
   4800, 'Multiple', 'Large dealer group, wants API integration',
   NOW() - INTERVAL '1 day', NOW());

-- ========================================
-- STEP 8: UPDATE CLIENT BRANDING DEFAULTS
-- ========================================

-- Update default client settings for B2B context
UPDATE clients 
SET branding_config = jsonb_set(
  branding_config,
  '{defaultFromName}',
  '"OfferLogix Sales Team"'
)
WHERE branding_config->>'defaultFromName' ILIKE '%dealer%';

UPDATE clients 
SET settings = jsonb_set(
  settings,
  '{emailSignature}',
  '"Best regards,\nThe OfferLogix Team\nInstant Credit Decisions for Dealerships"'
)
WHERE settings->>'emailSignature' ILIKE '%vehicle%' OR settings->>'emailSignature' ILIKE '%car%';

-- ========================================
-- STEP 9: VERIFICATION QUERIES
-- ========================================

-- Show summary of changes
DO $$
BEGIN
  RAISE NOTICE '=== B2B Migration Complete ===';
  RAISE NOTICE 'Leads table: vehicle_interest → product_interest';
  RAISE NOTICE 'Added B2B columns: company_name, dealership_type, decision_maker_role';
  RAISE NOTICE 'Updated lead sources to B2B contexts';
  RAISE NOTICE 'Updated lead statuses to B2B sales pipeline';
  RAISE NOTICE 'Transformed product interests from vehicles to OfferLogix products';
  RAISE NOTICE 'Updated campaigns and AI agents for B2B messaging';
  RAISE NOTICE 'Inserted sample dealership data';
END $$;

-- Show sample of updated data
SELECT 
  'Sample Updated Leads:' as info,
  COUNT(*) as total_leads,
  COUNT(DISTINCT company_name) as unique_dealerships,
  COUNT(DISTINCT dealership_type) as dealership_types
FROM leads;

COMMIT;

-- ========================================
-- ROLLBACK SCRIPT (if needed)
-- ========================================
-- To rollback these changes, run:
-- BEGIN;
-- ALTER TABLE leads RENAME COLUMN product_interest TO vehicle_interest;
-- ALTER TABLE leads DROP COLUMN IF EXISTS company_name;
-- ALTER TABLE leads DROP COLUMN IF EXISTS dealership_type;
-- ALTER TABLE leads DROP COLUMN IF EXISTS decision_maker_role;
-- ALTER TABLE leads DROP COLUMN IF EXISTS annual_volume;
-- ALTER TABLE leads DROP COLUMN IF EXISTS current_finance_provider;
-- -- Then restore original data values...
-- COMMIT;