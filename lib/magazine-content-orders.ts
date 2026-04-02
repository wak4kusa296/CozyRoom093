import { getDbPool } from "@/lib/db";

function normalizeName(value: string) {
  return value.trim();
}

function normalizeSlugs(values: string[]) {
  return Array.from(new Set(values.map((slug) => slug.trim()).filter(Boolean)));
}

async function getMagazineIdByName(name: string): Promise<string | null> {
  const n = normalizeName(name);
  if (!n) return null;
  const pool = getDbPool();
  const result = await pool.query<{ id: string }>(
    `SELECT id::text FROM magazines WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [n]
  );
  return result.rows[0]?.id ?? null;
}

export async function getMagazineContentOrders() {
  const pool = getDbPool();
  const result = await pool.query<{ name: string; ordered_slugs: string[] | null }>(
    `
    SELECT m.name, COALESCE(o.ordered_slugs, '{}') AS ordered_slugs
    FROM magazines m
    LEFT JOIN magazine_content_orders o ON o.magazine_id = m.id
    `
  );
  const out: Record<string, string[]> = {};
  for (const row of result.rows) {
    out[row.name] = Array.isArray(row.ordered_slugs) ? [...row.ordered_slugs] : [];
  }
  return out;
}

export async function setMagazineContentOrder(name: string, orderedSlugs: string[]) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return;

  const magazineId = await getMagazineIdByName(normalizedName);
  if (!magazineId) return;

  const slugs = normalizeSlugs(orderedSlugs);
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO magazine_content_orders (magazine_id, ordered_slugs)
    VALUES ($1::uuid, $2::text[])
    ON CONFLICT (magazine_id)
    DO UPDATE SET ordered_slugs = EXCLUDED.ordered_slugs
    `,
    [magazineId, slugs]
  );
}

/** マガジン名変更後は id ベースのため、実質 no-op（互換のため残す） */
export async function renameMagazineContentOrder(_fromName: string, _toName: string) {
  void _fromName;
  void _toName;
}

export async function deleteMagazineContentOrder(name: string) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) return;

  const magazineId = await getMagazineIdByName(normalizedName);
  if (!magazineId) return;

  const pool = getDbPool();
  await pool.query(`DELETE FROM magazine_content_orders WHERE magazine_id = $1::uuid`, [magazineId]);
}

export async function removeSlugFromMagazineContentOrder(name: string, slug: string) {
  const normalizedName = normalizeName(name);
  const normalizedSlug = slug.trim();
  if (!normalizedName || !normalizedSlug) return;

  const magazineId = await getMagazineIdByName(normalizedName);
  if (!magazineId) return;

  const pool = getDbPool();
  const cur = await pool.query<{ ordered_slugs: string[] }>(
    `SELECT ordered_slugs FROM magazine_content_orders WHERE magazine_id = $1::uuid`,
    [magazineId]
  );
  const list = cur.rows[0]?.ordered_slugs ?? [];
  const next = list.filter((item) => item !== normalizedSlug);
  await pool.query(
    `
    INSERT INTO magazine_content_orders (magazine_id, ordered_slugs)
    VALUES ($1::uuid, $2::text[])
    ON CONFLICT (magazine_id)
    DO UPDATE SET ordered_slugs = EXCLUDED.ordered_slugs
    `,
    [magazineId, next]
  );
}

export function sortItemsByMagazineOrder<T extends { slug: string; date?: string }>(items: T[], orderedSlugs: string[]) {
  const rank = new Map<string, number>();
  orderedSlugs.forEach((slug, index) => rank.set(slug, index));

  return [...items].sort((a, b) => {
    const aRank = rank.get(a.slug);
    const bRank = rank.get(b.slug);
    const aHasRank = typeof aRank === "number";
    const bHasRank = typeof bRank === "number";

    if (aHasRank && bHasRank) return aRank! - bRank!;
    if (aHasRank) return -1;
    if (bHasRank) return 1;

    const aDate = a.date ?? "";
    const bDate = b.date ?? "";
    if (aDate === bDate) return a.slug.localeCompare(b.slug, "ja");
    return aDate < bDate ? 1 : -1;
  });
}
