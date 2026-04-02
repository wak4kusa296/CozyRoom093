-- 環境変数 GUEST_PASSPHRASES からの同期で再挿入しない guest_id（管理画面で削除したユーザー）
CREATE TABLE IF NOT EXISTS guest_env_sync_suppress (
  guest_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
