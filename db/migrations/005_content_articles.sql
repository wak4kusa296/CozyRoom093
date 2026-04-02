-- 記事 Markdown を PostgreSQL に保持（Vercel 等の読み取り専用 FS 向け）。Git の content/*.md と併用可（同一 slug は DB が優先）。

CREATE TABLE IF NOT EXISTS content_articles (
  slug TEXT PRIMARY KEY,
  raw_markdown TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_articles_updated_at_idx ON content_articles (updated_at DESC);
