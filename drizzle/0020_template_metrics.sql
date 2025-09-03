ALTER TABLE templates
  ADD COLUMN sent_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN open_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN reply_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN handover_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN is_winner boolean DEFAULT false NOT NULL;