import { listBroadcastPushes, pushAppliesToGuest } from "@/lib/broadcast-pushes";
import { listPublicContents } from "@/lib/content";
import { listGuestCredentials } from "@/lib/guest-credentials";
import { listAdminLetterEventsForGuest } from "@/lib/letters";
import { getDbPool } from "@/lib/db";

export type GuestNotificationReadsFile = Record<string, Record<string, string>>;

export async function getAllGuestNotificationReads(): Promise<GuestNotificationReadsFile> {
  const pool = getDbPool();
  const result = await pool.query<{ guest_id: string; notification_id: string; read_at: Date }>(
    `SELECT guest_id, notification_id, read_at FROM guest_notification_reads`
  );
  const out: GuestNotificationReadsFile = {};
  for (const row of result.rows) {
    if (!out[row.guest_id]) out[row.guest_id] = {};
    out[row.guest_id]![row.notification_id] = row.read_at.toISOString();
  }
  return out;
}

export async function getGuestNotificationReadsMap(guestId: string): Promise<Record<string, string>> {
  const pool = getDbPool();
  const result = await pool.query<{ notification_id: string; read_at: Date }>(
    `SELECT notification_id, read_at FROM guest_notification_reads WHERE guest_id = $1`,
    [guestId]
  );
  const map: Record<string, string> = {};
  for (const row of result.rows) {
    map[row.notification_id] = row.read_at.toISOString();
  }
  return map;
}

export async function markGuestNotificationRead(guestId: string, id: string): Promise<void> {
  const pool = getDbPool();
  const now = new Date();
  await pool.query(
    `
    INSERT INTO guest_notification_reads (guest_id, notification_id, read_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (guest_id, notification_id)
    DO UPDATE SET read_at = EXCLUDED.read_at
    `,
    [guestId, id, now]
  );
}

export async function markContentNotificationReadAllGuests(slug: string): Promise<void> {
  const trimmed = slug.trim();
  if (!trimmed) return;
  const id = `content|${trimmed}`;
  const now = new Date();
  const guests = await listGuestCredentials();
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const g of guests) {
      await client.query(
        `
        INSERT INTO guest_notification_reads (guest_id, notification_id, read_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (guest_id, notification_id)
        DO UPDATE SET read_at = EXCLUDED.read_at
        `,
        [g.guestId, id, now]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function ensureGuestNotificationBaseline(guestId: string): Promise<void> {
  const map = await getGuestNotificationReadsMap(guestId);
  if (map["__baseline_v1"]) return;

  const now = new Date().toISOString();
  const publicItems = await listPublicContents();
  const adminLetters = await listAdminLetterEventsForGuest(guestId);
  const broadcasts = await listBroadcastPushes();

  const next: Record<string, string> = { ...map, __baseline_v1: now };
  for (const item of publicItems) {
    next[`content|${item.slug}`] = now;
  }
  for (const row of adminLetters) {
    next[row.id] = now;
  }
  for (const p of broadcasts) {
    if (pushAppliesToGuest(p, guestId)) {
      next[`push|${p.id}`] = now;
    }
  }

  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [nid, ts] of Object.entries(next)) {
      await client.query(
        `
        INSERT INTO guest_notification_reads (guest_id, notification_id, read_at)
        VALUES ($1, $2, $3::timestamptz)
        ON CONFLICT (guest_id, notification_id)
        DO UPDATE SET read_at = EXCLUDED.read_at
        `,
        [guestId, nid, ts]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
