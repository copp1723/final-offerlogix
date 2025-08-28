-- INTEGRITYLEADS Client Configuration
-- Run this in your PostgreSQL database

-- 1. Create the client
INSERT INTO clients (name, domain, branding_config, settings, active) 
VALUES (
  'Integrity Leads',
  'mg.integrityleads.com',
  '{
    "primaryColor": "#1f2937",
    "secondaryColor": "#374151", 
    "logoUrl": "",
    "companyName": "Integrity Leads",
    "favicon": "",
    "customCss": ""
  }',
  '{
    "allowAutoResponse": true,
    "businessHours": {
      "start": "08:00",
      "end": "18:00",
      "timezone": "America/New_York"
    }
  }',
  true
);

-- 2. Create AI agent config for INTEGRITYLEADS
INSERT INTO ai_agent_config (
  name, 
  tonality, 
  personality, 
  dos_list, 
  donts_list, 
  industry, 
  response_style,
  model,
  agent_email_domain,
  is_active,
  client_id
) 
VALUES (
  'Integrity Leads Agent',
  'professional',
  'Professional automotive sales consultant focused on building trust and providing value-driven vehicle recommendations',
  '["Always respond within business hours", "Focus on vehicle benefits", "Ask qualifying questions", "Provide transparent pricing", "Offer test drive scheduling"]',
  '["Never use aggressive sales tactics", "Avoid mentioning competitors negatively", "Don''t push for immediate decisions", "Never share customer data"]',
  'automotive',
  'consultative',
  'openai/gpt-5-chat',
  'mg.integrityleads.com',
  true,
  (SELECT id FROM clients WHERE domain = 'mg.integrityleads.com')
);