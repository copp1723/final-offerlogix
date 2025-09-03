-- Fix existing leads with NULL client_id
UPDATE leads 
SET client_id = (SELECT id FROM clients WHERE domain = 'localhost' LIMIT 1)
WHERE client_id IS NULL;