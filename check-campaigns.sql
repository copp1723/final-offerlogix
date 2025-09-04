-- Check what's in the campaigns table
SELECT id, name, client_id FROM campaigns;

-- Check what clients exist
SELECT id, name, domain, branding_config->>'companyName' as company_name FROM clients;

-- Update any Kunes references to OfferLogix
UPDATE campaigns SET name = REPLACE(name, 'Kunes', 'OfferLogix');
UPDATE campaigns SET name = REPLACE(name, 'MailMind', 'OfferLogix');