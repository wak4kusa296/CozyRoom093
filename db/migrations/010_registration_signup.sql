-- 手書きのパスワード（紙に書く／QR先で入力。管理者が無効化できる）
CREATE TABLE IF NOT EXISTS registration_gates (
  gate_id TEXT PRIMARY KEY,
  phrase TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS registration_gates_phrase_active_idx
  ON registration_gates (phrase)
  WHERE is_active = TRUE;

-- 自己登録の管理人向け通知（メアドは保存しない）
CREATE TABLE IF NOT EXISTS signup_notifications (
  id UUID PRIMARY KEY,
  guest_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  memo TEXT NOT NULL,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS signup_notifications_created_at_idx
  ON signup_notifications (created_at DESC);
