-- Add multi-touch sequence support to V2

-- 1) campaigns_v2: add sequence jsonb (array of steps)
ALTER TABLE campaigns_v2
  ADD COLUMN IF NOT EXISTS sequence jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Optional validation could be added with a CHECK constraint validating structure,
-- but we keep it flexible and validate at the application layer.

-- 2) leads_v2: add sequence tracking fields
ALTER TABLE leads_v2
  ADD COLUMN IF NOT EXISTS sequence_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS initial_sent_at timestamp NULL,
  ADD COLUMN IF NOT EXISTS next_send_at timestamp NULL;

-- 3) helpful index for scheduler
CREATE INDEX IF NOT EXISTS leads_v2_next_send_idx ON leads_v2 (next_send_at);

