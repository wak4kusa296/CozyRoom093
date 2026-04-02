import { getDbPool } from "@/lib/db";
import { HEART_LIMIT_PER_GUEST } from "./heart-constants";

export type HeartSummary = {
  slug: string;
  total: number;
  uniqueGuests: number;
};

function normalizeSlugKey(slug: string) {
  return slug.trim();
}

async function getRow(slug: string) {
  const key = normalizeSlugKey(slug);
  const pool = getDbPool();
  const result = await pool.query<{ total: number; by_guest: Record<string, number> }>(
    `SELECT total, by_guest FROM hearts WHERE slug = $1`,
    [key]
  );
  const row = result.rows[0];
  if (!row) {
    return { total: 0, by_guest: {} as Record<string, number> };
  }
  const byGuest =
    row.by_guest && typeof row.by_guest === "object" && !Array.isArray(row.by_guest)
      ? (row.by_guest as Record<string, number>)
      : {};
  return { total: row.total, by_guest: byGuest };
}

async function upsertRow(slug: string, total: number, byGuest: Record<string, number>) {
  const key = normalizeSlugKey(slug);
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO hearts (slug, total, by_guest, updated_at)
    VALUES ($1, $2, $3::jsonb, NOW())
    ON CONFLICT (slug)
    DO UPDATE SET
      total = EXCLUDED.total,
      by_guest = EXCLUDED.by_guest,
      updated_at = NOW()
    `,
    [key, total, JSON.stringify(byGuest)]
  );
}

export async function pressHeart(slug: string, guestId: string) {
  const current = await getRow(slug);
  const pressedByGuest = current.by_guest[guestId] ?? 0;

  if (pressedByGuest >= HEART_LIMIT_PER_GUEST) {
    return {
      accepted: false,
      pressedByGuest,
      remaining: 0
    };
  }

  const nextPressedByGuest = pressedByGuest + 1;
  const nextByGuest = { ...current.by_guest, [guestId]: nextPressedByGuest };
  const nextTotal = current.total + 1;
  await upsertRow(slug, nextTotal, nextByGuest);

  return {
    accepted: true,
    pressedByGuest: nextPressedByGuest,
    remaining: HEART_LIMIT_PER_GUEST - nextPressedByGuest
  };
}

export async function getHeartStateForGuest(slug: string, guestId: string) {
  const current = await getRow(slug);
  const pressedByGuest = current.by_guest[guestId] ?? 0;
  return {
    pressedByGuest,
    remaining: Math.max(0, HEART_LIMIT_PER_GUEST - pressedByGuest),
    limit: HEART_LIMIT_PER_GUEST,
    locked: pressedByGuest >= HEART_LIMIT_PER_GUEST
  };
}

export async function listHeartSummaries() {
  const pool = getDbPool();
  const result = await pool.query<{ slug: string; total: number; by_guest: Record<string, number> }>(
    `SELECT slug, total, by_guest FROM hearts WHERE total > 0`
  );
  return result.rows
    .map((row) => {
      const byGuest =
        row.by_guest && typeof row.by_guest === "object" && !Array.isArray(row.by_guest)
          ? (row.by_guest as Record<string, number>)
          : {};
      return {
        slug: row.slug,
        total: row.total,
        uniqueGuests: Object.keys(byGuest).length
      };
    })
    .sort((a, b) => b.total - a.total) satisfies HeartSummary[];
}
