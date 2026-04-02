import { getDbPool } from "@/lib/db";

export async function dbListContentSlugs(): Promise<string[]> {
  const pool = getDbPool();
  const result = await pool.query<{ slug: string }>(`SELECT slug FROM content_articles ORDER BY slug ASC`);
  return result.rows.map((r) => r.slug);
}

export async function dbGetRawMarkdown(slug: string): Promise<{ raw: string; updatedAt: string } | null> {
  const pool = getDbPool();
  const result = await pool.query<{ raw_markdown: string; updated_at: Date }>(
    `SELECT raw_markdown, updated_at FROM content_articles WHERE slug = $1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { raw: row.raw_markdown, updatedAt: row.updated_at.toISOString() };
}

export async function dbUpsertRawMarkdown(slug: string, raw: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(`DELETE FROM content_deleted_slugs WHERE slug = $1`, [slug]);
  await pool.query(
    `
    INSERT INTO content_articles (slug, raw_markdown, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (slug) DO UPDATE SET
      raw_markdown = EXCLUDED.raw_markdown,
      updated_at = NOW()
    `,
    [slug, raw]
  );
}

export async function dbDeleteRawMarkdown(slug: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(`DELETE FROM content_articles WHERE slug = $1`, [slug]);
}

/** Postgres + Git 併用時、DB から消しても残る content/*.md を一覧・表示から外す */
export async function dbRecordDeletedSlug(slug: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO content_deleted_slugs (slug, deleted_at)
    VALUES ($1, NOW())
    ON CONFLICT (slug) DO UPDATE SET deleted_at = NOW()
    `,
    [slug]
  );
}

export async function dbListDeletedSlugs(): Promise<Set<string>> {
  const pool = getDbPool();
  const result = await pool.query<{ slug: string }>(`SELECT slug FROM content_deleted_slugs`);
  return new Set(result.rows.map((r) => r.slug));
}

export async function dbIsSlugDeleted(slug: string): Promise<boolean> {
  const pool = getDbPool();
  const result = await pool.query(`SELECT 1 FROM content_deleted_slugs WHERE slug = $1 LIMIT 1`, [slug]);
  return result.rowCount !== null && result.rowCount > 0;
}
