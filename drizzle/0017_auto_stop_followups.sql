CREATE TABLE IF NOT EXISTS lead_campaign_state (
  lead_id varchar NOT NULL REFERENCES leads(id),
  campaign_id varchar NOT NULL REFERENCES campaigns(id),
  responded_at timestamp,
  followup_state varchar NOT NULL DEFAULT 'active',
  PRIMARY KEY (lead_id, campaign_id)
);