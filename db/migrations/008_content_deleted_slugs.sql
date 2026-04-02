-- Git の content/*.md が読み取り専用で消せない環境でも、管理画面から「削除した」slug を一覧から除外する。

CREATE TABLE IF NOT EXISTS content_deleted_slugs (
  slug TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_deleted_slugs_deleted_at_idx ON content_deleted_slugs (deleted_at DESC);
