import { getDbPool } from "@/lib/db";

/** マイグレーション 008 未適用時（本番DBの更新漏れ）に 42P01 で落ちないようにする */
function isMissingDeletedSlugsRelation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "42P01";
}

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
  try {
    await pool.query(`DELETE FROM content_deleted_slugs WHERE slug = $1`, [slug]);
  } catch (err) {
    if (!isMissingDeletedSlugsRelation(err)) throw err;
  }
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
  try {
    await pool.query(
      `
    INSERT INTO content_deleted_slugs (slug, deleted_at)
    VALUES ($1, NOW())
    ON CONFLICT (slug) DO UPDATE SET deleted_at = NOW()
    `,
      [slug]
    );
  } catch (err) {
    if (!isMissingDeletedSlugsRelation(err)) throw err;
  }
}

export async function dbListDeletedSlugs(): Promise<Set<string>> {
  const pool = getDbPool();
  try {
    const result = await pool.query<{ slug: string }>(`SELECT slug FROM content_deleted_slugs`);
    return new Set(result.rows.map((r) => r.slug));
  } catch (err) {
    if (isMissingDeletedSlugsRelation(err)) return new Set();
    throw err;
  }
}

export async function dbIsSlugDeleted(slug: string): Promise<boolean> {
  const pool = getDbPool();
  try {
    const result = await pool.query(`SELECT 1 FROM content_deleted_slugs WHERE slug = $1 LIMIT 1`, [slug]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (err) {
    if (isMissingDeletedSlugsRelation(err)) return false;
    throw err;
  }
}
