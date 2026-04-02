-- 管理画面「プッシュ通知」用画像。Vercel では public/uploads/push へ書けないため DB に保持。

CREATE TABLE IF NOT EXISTS push_upload_blobs (
  filename TEXT PRIMARY KEY,
  data BYTEA NOT NULL,
  content_type TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
