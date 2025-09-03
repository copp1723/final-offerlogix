-- Setup script for Kunes Auto Group dealerships using kunesauto.vip
-- Run this after your MailMind database is initialized

-- Insert client records for each dealership
INSERT INTO clients (name, domain, settings, active) VALUES 
('Kunes Auto Group of Macomb', 'kunesauto.vip', '{
  "mailgunDomain": "kunesmacomb.kunesauto.vip",
  "brandColor": "#1f2937",
  "dealershipType": "multi-brand",
  "location": "Macomb, IL"
}'::jsonb, true),

('Kunes Honda of Quincy', 'kunesauto.vip', '{
  "mailgunDomain": "kuneshonda.kunesauto.vip", 
  "brandColor": "#e60012",
  "dealershipType": "honda",
  "location": "Quincy, IL"
}'::jsonb, true),

('Kunes Hyundai of Quincy', 'kunesauto.vip', '{
  "mailgunDomain": "kuneshyundai.kunesauto.vip",
  "brandColor": "#002c5f", 
  "dealershipType": "hyundai",
  "location": "Quincy, IL"
}'::jsonb, true),

('Kunes Ford of East Moline', 'kunesauto.vip', '{
  "mailgunDomain": "kunesford.kunesauto.vip",
  "brandColor": "#003478",
  "dealershipType": "ford", 
  "location": "East Moline, IL"
}'::jsonb, true),

('Kunes Nissan of Davenport', 'kunesauto.vip', '{
  "mailgunDomain": "kunesnissan.kunesauto.vip",
  "brandColor": "#c3002f",
  "dealershipType": "nissan",
  "location": "Davenport, IA" 
}'::jsonb, true),

('Kunes Toyota of Galesburg', 'kunesauto.vip', '{
  "mailgunDomain": "kunestoyota.kunesauto.vip",
  "brandColor": "#eb0a1e",
  "dealershipType": "toyota",
  "location": "Galesburg, IL"
}'::jsonb, true);

-- Get the client IDs for reference
SELECT id, name, settings->>'mailgunDomain' as email_domain FROM clients WHERE name LIKE 'Kunes%' ORDER BY name;