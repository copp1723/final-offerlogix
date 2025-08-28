-- OFFERLOGIX Client Configuration
-- Run this in your PostgreSQL database

-- 1. Create the client
INSERT INTO clients (name, domain, branding_config, settings, active) 
VALUES (
  'OfferLogix',
  'mg.offerlogix.com',
  '{
    "primaryColor": "#059669",
    "secondaryColor": "#047857", 
    "logoUrl": "",
    "companyName": "OfferLogix",
    "favicon": "",
    "customCss": ""
  }',
  '{
    "allowAutoResponse": true,
    "businessHours": {
      "start": "09:00",
      "end": "17:00",
      "timezone": "America/New_York"
    }
  }',
  true
);

-- 2. Create AI agent config for OFFERLOGIX
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
  'OfferLogix Sales Agent',
  'friendly',
  'Dynamic automotive sales expert specializing in compelling offers and deal optimization. Focused on creating urgency while maintaining trust.',
  '["Highlight special offers and incentives", "Create appropriate urgency", "Focus on value propositions", "Ask about timeline and budget", "Offer competitive financing options", "Provide clear next steps"]',
  '["Never use high-pressure tactics", "Don''t make unrealistic promises", "Avoid overwhelming with too many options", "Never ignore customer concerns", "Don''t rush the decision process"]',
  'automotive',
  'consultative',
  'openai/gpt-5-chat',
  'mg.offerlogix.com',
  true,
  (SELECT id FROM clients WHERE domain = 'mg.offerlogix.com')
);