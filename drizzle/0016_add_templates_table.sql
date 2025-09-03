-- Migration: 0016_add_templates_table
-- Adds templates table to store campaign email templates

CREATE TABLE IF NOT EXISTS templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id varchar REFERENCES campaigns(id) ON DELETE CASCADE,
    subject text NOT NULL,
    body_html text NOT NULL,
    body_text text NOT NULL,
    version integer NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

-- Add index on campaign_id for better query performance
CREATE INDEX IF NOT EXISTS idx_templates_campaign_id ON templates(campaign_id);