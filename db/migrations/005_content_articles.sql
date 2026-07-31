-- 記事 Markdown の唯一の実行時保存先。content/*.md は開発時のインポート元としてのみ使用する。

CREATE TABLE IF NOT EXISTS content_articles (
  slug TEXT PRIMARY KEY,
  raw_markdown TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_articles_updated_at_idx ON content_articles (updated_at DESC);
