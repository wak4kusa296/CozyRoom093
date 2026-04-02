-- サムネイル画像（管理画面アップロード）。Vercel では public/thumbnails へ書けないため DB に保持。

CREATE TABLE IF NOT EXISTS thumbnail_blobs (
  filename TEXT PRIMARY KEY,
  data BYTEA NOT NULL,
  content_type TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
