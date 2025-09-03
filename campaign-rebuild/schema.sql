-- Simplified Campaign Management System
-- Clean architecture for reliable AI-powered email campaigns

-- ============================================
-- AGENTS - One agent per business/dealership
-- ============================================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name VARCHAR(255) NOT NULL, -- e.g., "Sarah - Toyota Sales"
  business_name VARCHAR(255) NOT NULL, -- e.g., "Toyota of Downtown"
  
  -- Email Configuration (CRITICAL)
  subdomain VARCHAR(255) NOT NULL UNIQUE, -- e.g., "toyota" for toyota.okcrm.ai
  sender_name VARCHAR(255) NOT NULL, -- e.g., "Sarah Mitchell"
  sender_email VARCHAR(255) NOT NULL UNIQUE, -- e.g., "sarah@toyota.okcrm.ai"
  
  -- Agent Personality
  role VARCHAR(255), -- e.g., "Sales Consultant"
  goal TEXT, -- e.g., "help customers find their perfect Toyota"
  
  -- System Prompt Configuration
  system_prompt TEXT NOT NULL, -- Template with {placeholders}
  prompt_variables JSONB DEFAULT '{}', -- Values for placeholders
  
  -- Handover Configuration
  handover_triggers TEXT[], -- Keywords that trigger handover
  max_messages INT DEFAULT 8, -- Max messages before suggesting handover
  confidence_threshold DECIMAL(3,2) DEFAULT 0.70, -- Min confidence for AI responses
  handover_email VARCHAR(255), -- Where to send handover notifications
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CAMPAIGNS - Simple campaign management
-- ============================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) NOT NULL,
  
  -- Campaign Info
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  initial_message TEXT NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LEADS - Recipients of campaigns
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact Info
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  
  -- Custom Fields for Personalization
  custom_fields JSONB DEFAULT '{}',
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, unsubscribed, bounced
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CONVERSATIONS - Email threads
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) NOT NULL,
  lead_id UUID REFERENCES leads(id) NOT NULL,
  campaign_id UUID REFERENCES campaigns(id),
  
  -- Threading Info (CRITICAL)
  thread_id VARCHAR(255) NOT NULL UNIQUE, -- Unique thread identifier
  initial_message_id VARCHAR(500), -- First email's Message-ID
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, handed_over, completed
  handed_over_at TIMESTAMP,
  handover_reason TEXT,
  
  -- Metrics
  message_count INT DEFAULT 0,
  ai_message_count INT DEFAULT 0,
  last_message_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(agent_id, lead_id, campaign_id)
);

-- ============================================
-- MESSAGES - Individual emails in conversations
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  
  -- Message Info
  direction VARCHAR(20) NOT NULL, -- inbound, outbound
  sender_type VARCHAR(20) NOT NULL, -- agent, lead, human
  
  -- Email Headers (CRITICAL for threading)
  message_id VARCHAR(500) UNIQUE, -- Email Message-ID header
  in_reply_to VARCHAR(500), -- Email In-Reply-To header
  references TEXT, -- Email References header chain
  
  -- Content
  subject VARCHAR(500),
  content TEXT NOT NULL,
  
  -- AI Metadata
  ai_confidence DECIMAL(3,2), -- Confidence score if AI-generated
  ai_model VARCHAR(100), -- Model used for generation
  
  -- Delivery Status
  status VARCHAR(50) DEFAULT 'sent', -- sent, delivered, bounced, failed
  delivered_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- HANDOVERS - When humans need to take over
-- ============================================
CREATE TABLE handovers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) NOT NULL,
  
  -- Trigger Info
  trigger_type VARCHAR(50) NOT NULL, -- keyword, max_messages, low_confidence, manual
  trigger_detail TEXT, -- What specifically triggered it
  
  -- Assignment
  status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, resolved
  assigned_to VARCHAR(255), -- Email of human agent
  assigned_at TIMESTAMP,
  resolved_at TIMESTAMP,
  
  -- Context
  conversation_summary TEXT, -- AI-generated summary
  suggested_response TEXT, -- AI suggestion for human
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SYSTEM_PROMPTS - Reusable prompt templates
-- ============================================
CREATE TABLE system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Prompt Template
  template TEXT NOT NULL,
  available_placeholders TEXT[],
  
  -- Usage
  is_default BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WEBHOOK_EVENTS - Track inbound webhooks
-- ============================================
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Info
  event_type VARCHAR(50) NOT NULL, -- email_received, email_opened, email_clicked
  provider VARCHAR(50) NOT NULL, -- mailgun
  
  -- Deduplication
  provider_message_id VARCHAR(500) UNIQUE, -- Mailgun Message-ID
  
  -- Raw Data
  raw_payload JSONB,
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX idx_conversations_lead_id ON conversations(lead_id);
CREATE INDEX idx_conversations_thread_id ON conversations(thread_id);
CREATE INDEX idx_conversations_status ON conversations(status);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_message_id ON messages(message_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_handovers_conversation_id ON handovers(conversation_id);
CREATE INDEX idx_handovers_status ON handovers(status);

CREATE INDEX idx_webhook_events_provider_message_id ON webhook_events(provider_message_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);

-- ============================================
-- DEFAULT SYSTEM PROMPT
-- ============================================
INSERT INTO system_prompts (name, description, template, available_placeholders, is_default) 
VALUES (
  'Default Sales Agent',
  'Standard template for automotive sales agents',
  'You are {agent_name}, a {role} at {business_name}.

Your primary goal is to {goal}.

## Communication Guidelines
- Keep responses concise (2-3 sentences maximum)
- Be friendly and professional
- Focus on understanding the customer''s needs
- Ask one clarifying question at a time
- Use the customer''s name when known

## Handover Triggers
If the customer mentions any of these, indicate you''ll connect them with a specialist:
- Specific pricing or discounts
- Financing details or credit issues
- Trade-in valuations
- Wanting to speak to a human or manager
- Complex technical questions you cannot answer

## Important Rules
- Never make promises about pricing or availability without confirmation
- Don''t schedule appointments without verification
- Be honest if you don''t know something
- Focus on building rapport and gathering information

Remember: Your role is to engage, qualify, and smoothly hand over to human agents when appropriate.',
  ARRAY[
    '{agent_name}',
    '{role}',
    '{business_name}',
    '{goal}'
  ],
  true
);

-- ============================================
-- SAMPLE AGENT CONFIGURATION
-- ============================================
INSERT INTO agents (
  name,
  business_name,
  subdomain,
  sender_name,
  sender_email,
  role,
  goal,
  system_prompt,
  prompt_variables,
  handover_triggers,
  max_messages,
  confidence_threshold,
  handover_email
) VALUES (
  'Sarah - Toyota Sales',
  'Toyota of Downtown',
  'toyota',
  'Sarah Mitchell',
  'sarah@toyota.okcrm.ai',
  'Sales Consultant',
  'help customers find their perfect Toyota vehicle',
  'You are {agent_name}, a {role} at {business_name}. Your goal is to {goal}. Be helpful and professional.',
  '{
    "agent_name": "Sarah Mitchell",
    "role": "Sales Consultant",
    "business_name": "Toyota of Downtown",
    "goal": "help customers find their perfect Toyota"
  }'::jsonb,
  ARRAY[
    'speak to human',
    'talk to manager',
    'price',
    'discount',
    'financing',
    'credit',
    'trade in'
  ],
  8,
  0.70,
  'sales-manager@toyotadowntown.com'
);