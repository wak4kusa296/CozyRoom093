DROP TABLE IF EXISTS entry_logs;

CREATE TABLE IF NOT EXISTS guest_credentials (
  guest_id TEXT PRIMARY KEY,
  guest_name TEXT NOT NULL,
  phrase TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_credentials_phrase_active_idx
  ON guest_credentials (phrase)
  WHERE is_active = TRUE;
