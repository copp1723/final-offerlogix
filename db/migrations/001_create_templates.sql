CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_campaign_id ON templates(campaign_id);