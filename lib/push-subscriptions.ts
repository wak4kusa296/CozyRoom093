import { getDbPool } from "@/lib/db";

/** クライアント `PushSubscription.prototype.toJSON()` 互換 */
export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: { p256dh: string; auth: string };
};

export async function upsertGuestPushSubscription(guestId: string, sub: PushSubscriptionJSON): Promise<void> {
  const g = guestId.trim();
  const endpoint = sub.endpoint?.trim();
  const p256dh = sub.keys?.p256dh?.trim();
  const auth = sub.keys?.auth?.trim();
  if (!g || !endpoint || !p256dh || !auth) return;

  const pool = getDbPool();
  const exp =
    sub.expirationTime == null || sub.expirationTime === undefined
      ? null
      : new Date(sub.expirationTime as number);
  await pool.query(
    `
    INSERT INTO push_subscriptions (guest_id, endpoint, keys_p256dh, keys_auth, expiration_time)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (guest_id, endpoint)
    DO UPDATE SET
      keys_p256dh = EXCLUDED.keys_p256dh,
      keys_auth = EXCLUDED.keys_auth,
      expiration_time = EXCLUDED.expiration_time
    `,
    [g, endpoint, p256dh, auth, exp]
  );
}

export async function removeGuestPushSubscription(guestId: string, endpoint: string): Promise<void> {
  const g = guestId.trim();
  const ep = endpoint.trim();
  if (!g || !ep) return;

  const pool = getDbPool();
  await pool.query(`DELETE FROM push_subscriptions WHERE guest_id = $1 AND endpoint = $2`, [g, ep]);
}

export async function listSubscriptionsForGuests(guestIds: string[]): Promise<
  Array<{ guestId: string; subscription: PushSubscriptionJSON }>
> {
  const pool = getDbPool();
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of guestIds) {
    const g = id.trim();
    if (!g || seen.has(g)) continue;
    seen.add(g);
    ids.push(g);
  }
  if (ids.length === 0) return [];

  const result = await pool.query<{
    guest_id: string;
    endpoint: string;
    keys_p256dh: string;
    keys_auth: string;
    expiration_time: Date | null;
  }>(
    `
    SELECT guest_id, endpoint, keys_p256dh, keys_auth, expiration_time
    FROM push_subscriptions
    WHERE guest_id = ANY($1::text[])
    `,
    [ids]
  );

  const out: Array<{ guestId: string; subscription: PushSubscriptionJSON }> = [];
  for (const row of result.rows) {
    out.push({
      guestId: row.guest_id,
      subscription: {
        endpoint: row.endpoint,
        expirationTime: row.expiration_time ? row.expiration_time.getTime() : null,
        keys: { p256dh: row.keys_p256dh, auth: row.keys_auth }
      }
    });
  }
  return out;
}

export async function countPushSubscriptions(): Promise<number> {
  const pool = getDbPool();
  const result = await pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM push_subscriptions`);
  const n = result.rows[0]?.c;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export async function listAllPushSubscriptions(): Promise<
  Array<{ guestId: string; subscription: PushSubscriptionJSON }>
> {
  const pool = getDbPool();
  const result = await pool.query<{
    guest_id: string;
    endpoint: string;
    keys_p256dh: string;
    keys_auth: string;
    expiration_time: Date | null;
  }>(`
    SELECT guest_id, endpoint, keys_p256dh, keys_auth, expiration_time
    FROM push_subscriptions
  `);

  return result.rows.map((row) => ({
    guestId: row.guest_id,
    subscription: {
      endpoint: row.endpoint,
      expirationTime: row.expiration_time ? row.expiration_time.getTime() : null,
      keys: { p256dh: row.keys_p256dh, auth: row.keys_auth }
    }
  }));
}
