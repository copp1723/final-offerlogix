-- Update all client branding to OfferLogix
UPDATE clients 
SET branding_config = jsonb_set(
    COALESCE(branding_config, '{}'::jsonb),
    '{companyName}',
    '"OfferLogix"'
)
WHERE branding_config->>'companyName' = 'MailMind' 
   OR branding_config->>'companyName' IS NULL
   OR branding_config->>'companyName' = '';

-- Also update the client name if it's still MailMind
UPDATE clients 
SET name = 'OfferLogix'
WHERE name = 'Default Client' OR name = 'MailMind' OR name LIKE '%MailMind%';

-- Show the updated clients
SELECT id, name, domain, branding_config->>'companyName' as company_name FROM clients;