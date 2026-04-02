CREATE TABLE IF NOT EXISTS entry_logs (
  id BIGSERIAL PRIMARY KEY,
  guest_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('guest', 'admin')),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hearts (
  slug TEXT PRIMARY KEY,
  total INTEGER NOT NULL DEFAULT 0,
  by_guest JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS letters (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS letters_slug_guest_created_idx
  ON letters (slug, guest_id, created_at);

CREATE TABLE IF NOT EXISTS content_overrides (
  slug TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('public', 'private')),
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
