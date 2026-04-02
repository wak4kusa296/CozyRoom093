-- アプリデータを PostgreSQL に集約。実行時に既存行はクリア（管理人は .env の ADMIN_SECRET のみ）

CREATE TABLE IF NOT EXISTS push_subscriptions (
  guest_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  expiration_time TIMESTAMPTZ,
  PRIMARY KEY (guest_id, endpoint)
);

CREATE TABLE IF NOT EXISTS magazines (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS magazines_name_lower_idx ON magazines (LOWER(name));

CREATE TABLE IF NOT EXISTS magazine_content_orders (
  magazine_id UUID PRIMARY KEY REFERENCES magazines (id) ON DELETE CASCADE,
  ordered_slugs TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS guest_notification_reads (
  guest_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (guest_id, notification_id)
);

CREATE TABLE IF NOT EXISTS letter_notification_reads (
  id TEXT PRIMARY KEY,
  read_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS broadcast_pushes (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('all', 'selected')),
  guest_ids TEXT[] NOT NULL DEFAULT '{}',
  lead TEXT,
  link_url TEXT,
  link_label TEXT,
  image_url TEXT
);

CREATE INDEX IF NOT EXISTS broadcast_pushes_sent_at_idx ON broadcast_pushes (sent_at DESC);

CREATE TABLE IF NOT EXISTS recovery_requests (
  id UUID PRIMARY KEY,
  hint_name TEXT NOT NULL,
  hint_place TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS recovery_requests_created_at_idx ON recovery_requests (created_at DESC);

TRUNCATE TABLE
  magazine_content_orders,
  magazines,
  push_subscriptions,
  guest_notification_reads,
  letter_notification_reads,
  broadcast_pushes,
  recovery_requests,
  letters,
  hearts,
  content_overrides,
  guest_credentials
RESTART IDENTITY CASCADE;
