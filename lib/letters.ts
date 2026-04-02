import { getDbPool } from "@/lib/db";
import { markLetterNotificationRead } from "@/lib/letter-notification-reads";

export type Letter = {
  sender: string;
  body: string;
  createdAt: string;
};

export function normalizeThreadKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export type LetterThreadSummary = {
  slugKey: string;
  guestKey: string;
  count: number;
  latestAt: string | null;
  latestSender: string | null;
  latestBody: string | null;
};

export async function getLetters(slug: string, guestId: string) {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  type Row = { sender: string; body: string; created_at: Date };
  const result = await pool.query<Row>(
    `
    SELECT sender, body, created_at
    FROM letters
    WHERE slug = $1 AND guest_id = $2
    ORDER BY created_at ASC
    `,
    [slugKey, guestKey]
  );
  return result.rows.map((row: Row) => ({
    sender: row.sender,
    body: row.body,
    createdAt: row.created_at.toISOString()
  })) satisfies Letter[];
}

export async function appendLetter(slug: string, guestId: string, letter: Letter) {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO letters (slug, guest_id, sender, body, created_at)
    VALUES ($1, $2, $3, $4, $5::timestamptz)
    `,
    [slugKey, guestKey, letter.sender, letter.body, letter.createdAt]
  );
  return getLetters(slug, guestId);
}

export async function listLetterThreads() {
  type ThreadRow = {
    slug: string;
    guest_id: string;
    count: number;
    latest_at: Date;
    latest_sender: string;
    latest_body: string;
  };
  const pool = getDbPool();
  const result = await pool.query<ThreadRow>(
    `
    WITH agg AS (
      SELECT
        slug,
        guest_id,
        COUNT(*)::int AS count,
        MAX(created_at) AS latest_at
      FROM letters
      GROUP BY slug, guest_id
    ),
    latest AS (
      SELECT DISTINCT ON (slug, guest_id)
        slug,
        guest_id,
        sender AS latest_sender,
        body AS latest_body,
        created_at AS latest_at
      FROM letters
      ORDER BY slug, guest_id, created_at DESC
    )
    SELECT
      a.slug,
      a.guest_id,
      a.count,
      a.latest_at,
      l.latest_sender,
      l.latest_body
    FROM agg a
    JOIN latest l ON l.slug = a.slug AND l.guest_id = a.guest_id
    ORDER BY a.latest_at DESC
    `
  );

  return result.rows.map((row: ThreadRow) => ({
    slugKey: row.slug,
    guestKey: row.guest_id,
    count: row.count,
    latestAt: row.latest_at.toISOString(),
    latestSender: row.latest_sender,
    latestBody: row.latest_body
  })) satisfies LetterThreadSummary[];
}

export type GuestLetterEvent = {
  id: string;
  slugKey: string;
  guestKey: string;
  sender: string;
  body: string;
  createdAt: string;
};

export function guestLetterEventId(slugKey: string, guestKey: string, createdAt: string) {
  return `letter|${slugKey}|${guestKey}|${createdAt}`;
}

export function isAdminSender(sender: string) {
  const normalized = sender.trim().toLowerCase();
  return normalized === "管理者" || normalized === "admin";
}

export type AdminLetterEvent = {
  id: string;
  slugKey: string;
  guestKey: string;
  body: string;
  createdAt: string;
};

export function adminLetterNotificationId(slugKey: string, guestKey: string, createdAt: string) {
  return `adminLetter|${slugKey}|${guestKey}|${createdAt}`;
}

export async function listAdminLetterEventsForGuest(guestId: string): Promise<AdminLetterEvent[]> {
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  const result = await pool.query<{
    slug: string;
    guest_id: string;
    sender: string;
    body: string;
    created_at: Date;
  }>(
    `
    SELECT slug, guest_id, sender, body, created_at
    FROM letters
    WHERE guest_id = $1
    ORDER BY created_at ASC
    `,
    [guestKey]
  );

  const events: AdminLetterEvent[] = [];
  for (const row of result.rows) {
    if (!isAdminSender(row.sender)) continue;
    const slugKey = row.slug;
    const gk = row.guest_id;
    const createdAt = row.created_at.toISOString();
    events.push({
      id: adminLetterNotificationId(slugKey, gk, createdAt),
      slugKey,
      guestKey: gk,
      body: row.body,
      createdAt
    });
  }
  return events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listGuestLetterEvents(): Promise<GuestLetterEvent[]> {
  const pool = getDbPool();
  const result = await pool.query<{
    slug: string;
    guest_id: string;
    sender: string;
    body: string;
    created_at: Date;
  }>(
    `
    SELECT slug, guest_id, sender, body, created_at
    FROM letters
    ORDER BY created_at ASC
    `
  );

  const events: GuestLetterEvent[] = [];
  for (const row of result.rows) {
    if (isAdminSender(row.sender)) continue;
    const slugKey = row.slug;
    const guestKey = row.guest_id;
    const createdAt = row.created_at.toISOString();
    events.push({
      id: guestLetterEventId(slugKey, guestKey, createdAt),
      slugKey,
      guestKey,
      sender: row.sender,
      body: row.body,
      createdAt
    });
  }
  return events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function markGuestLetterNotificationsReadForThread(slug: string, guestId: string): Promise<void> {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const threadLetters = await getLetters(slug, guestId);
  for (const letter of threadLetters) {
    if (isAdminSender(letter.sender)) continue;
    await markLetterNotificationRead(guestLetterEventId(slugKey, guestKey, letter.createdAt));
  }
}
