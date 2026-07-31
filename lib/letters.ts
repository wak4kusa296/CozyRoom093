import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/db";
import {
  adminLetterNotificationId,
  guestLetterEventId,
  normalizeLetterTitle,
  normalizeThreadKey,
  type Letter,
  type LetterThreadSummary,
  type NewLetterInput,
  type SenderRole
} from "@/lib/letters-shared";

export type {
  Letter,
  LetterThreadSummary,
  NewLetterInput,
  SenderRole
} from "@/lib/letters-shared";

export {
  ADMIN_DISPLAY_NAME,
  FAN_LETTER_SLUG,
  FAN_LETTER_TITLE,
  LETTER_BODY_MAX_LENGTH,
  LETTER_TITLE_MAX_LENGTH,
  LETTER_REPLY_PUSH_BODY,
  adminLetterNotificationId,
  guestLetterEventId,
  guestLetterOpenUrl,
  isFanLetterSlug,
  isStandaloneLetterSlug,
  letterNewThreadPushBody,
  letterThreadDisplayTitle,
  normalizeLetterTitle,
  normalizeThreadKey
} from "@/lib/letters-shared";

/** 記事に紐づかない新規お手紙スレッド用のスラッグを発行する（`__note-` + UUID） */
export function createStandaloneLetterSlug(): string {
  return normalizeThreadKey(`__note-${randomUUID()}`);
}

export async function getLetterThreadTitle(slug: string, guestId: string): Promise<string | null> {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  const result = await pool.query<{ title: string }>(
    `
    SELECT title
    FROM letter_thread_meta
    WHERE slug = $1 AND guest_id = $2
    LIMIT 1
    `,
    [slugKey, guestKey]
  );
  return result.rows[0]?.title ?? null;
}

export async function setLetterThreadTitle(slug: string, guestId: string, titleInput: string): Promise<void> {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const title = normalizeLetterTitle(titleInput);
  if (!title) throw new Error("title_required");
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO letter_thread_meta (slug, guest_id, title)
    VALUES ($1, $2, $3)
    ON CONFLICT (slug, guest_id) DO NOTHING
    `,
    [slugKey, guestKey, title]
  );
}

type LetterRow = { id: number; sender: string; sender_role: SenderRole; body: string; created_at: Date };

function mapLetterRow(row: LetterRow): Letter {
  return {
    id: row.id,
    sender: row.sender,
    senderRole: row.sender_role,
    body: row.body,
    createdAt: row.created_at.toISOString()
  };
}

export async function getLetters(slug: string, guestId: string): Promise<Letter[]> {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  const result = await pool.query<LetterRow>(
    `
    SELECT id, sender, sender_role, body, created_at
    FROM letters
    WHERE slug = $1 AND guest_id = $2
    ORDER BY created_at ASC
    `,
    [slugKey, guestKey]
  );
  return result.rows.map(mapLetterRow);
}

/** 1 件だけ挿入して返す（スレッド全体の再取得が不要な呼び出し元向け） */
export async function insertLetter(slug: string, guestId: string, letter: NewLetterInput): Promise<Letter> {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  const result = await pool.query<LetterRow>(
    `
    INSERT INTO letters (slug, guest_id, sender, sender_role, body, created_at)
    VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
    RETURNING id, sender, sender_role, body, created_at
    `,
    [slugKey, guestKey, letter.sender, letter.senderRole, letter.body, letter.createdAt]
  );
  return mapLetterRow(result.rows[0]!);
}

/** 挿入してスレッド全体を返す（クライアントが往復書簡全体を必要とする呼び出し元向け） */
export async function appendLetter(slug: string, guestId: string, letter: NewLetterInput): Promise<Letter[]> {
  await insertLetter(slug, guestId, letter);
  return getLetters(slug, guestId);
}

/**
 * 直近 60 秒以内に同一ゲストが投函した件数（簡易レート制限用）。
 * 管理人からの返信は対象外にし、管理人の連続返信がゲストの投函を巻き込んで制限されないようにする。
 */
export async function countRecentLettersFromGuest(guestId: string): Promise<number> {
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  const result = await pool.query<{ count: number }>(
    `
    SELECT COUNT(*)::int AS count
    FROM letters
    WHERE guest_id = $1 AND sender_role = 'guest' AND created_at > NOW() - INTERVAL '60 seconds'
    `,
    [guestKey]
  );
  return result.rows[0]?.count ?? 0;
}

type ThreadRow = {
  slug: string;
  guest_id: string;
  count: number;
  latest_at: Date;
  latest_sender: string;
  latest_sender_role: SenderRole;
  latest_body: string;
  title: string | null;
};

function mapThreadRow(row: ThreadRow): LetterThreadSummary {
  return {
    slugKey: row.slug,
    guestKey: row.guest_id,
    count: row.count,
    latestAt: row.latest_at.toISOString(),
    latestSender: row.latest_sender,
    latestSenderRole: row.latest_sender_role,
    latestBody: row.latest_body,
    title: row.title
  };
}

export async function listLetterThreads(): Promise<LetterThreadSummary[]> {
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
        sender_role AS latest_sender_role,
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
      l.latest_sender_role,
      l.latest_body,
      m.title
    FROM agg a
    JOIN latest l ON l.slug = a.slug AND l.guest_id = a.guest_id
    LEFT JOIN letter_thread_meta m
      ON m.slug = a.slug AND m.guest_id = a.guest_id
    ORDER BY a.latest_at DESC
    `
  );

  return result.rows.map(mapThreadRow);
}

/** ゲスト本人の文通スレッド一覧（最新順） */
export async function listLetterThreadsForGuest(guestId: string): Promise<LetterThreadSummary[]> {
  const guestKey = normalizeThreadKey(guestId);
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
      WHERE guest_id = $1
      GROUP BY slug, guest_id
    ),
    latest AS (
      SELECT DISTINCT ON (slug, guest_id)
        slug,
        guest_id,
        sender AS latest_sender,
        sender_role AS latest_sender_role,
        body AS latest_body,
        created_at AS latest_at
      FROM letters
      WHERE guest_id = $1
      ORDER BY slug, guest_id, created_at DESC
    )
    SELECT
      a.slug,
      a.guest_id,
      a.count,
      a.latest_at,
      l.latest_sender,
      l.latest_sender_role,
      l.latest_body,
      m.title
    FROM agg a
    JOIN latest l ON l.slug = a.slug AND l.guest_id = a.guest_id
    LEFT JOIN letter_thread_meta m
      ON m.slug = a.slug AND m.guest_id = a.guest_id
    ORDER BY a.latest_at DESC
    `,
    [guestKey]
  );

  return result.rows.map(mapThreadRow);
}

export type GuestLetterEvent = {
  id: string;
  slugKey: string;
  guestKey: string;
  sender: string;
  body: string;
  createdAt: string;
};

export type AdminLetterEvent = {
  id: string;
  slugKey: string;
  guestKey: string;
  body: string;
  createdAt: string;
};

/** 管理人からゲストへの便り一覧。`slugKey` を渡すとそのスレッドのみに絞り込む */
export async function listAdminLetterEventsForGuest(guestId: string, slugKey?: string): Promise<AdminLetterEvent[]> {
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  const params: string[] = [guestKey];
  let where = "guest_id = $1 AND sender_role = 'admin'";
  if (slugKey) {
    params.push(normalizeThreadKey(slugKey));
    where += ` AND slug = $${params.length}`;
  }
  const result = await pool.query<{
    id: number;
    slug: string;
    guest_id: string;
    body: string;
    created_at: Date;
  }>(
    `
    SELECT id, slug, guest_id, body, created_at
    FROM letters
    WHERE ${where}
    ORDER BY created_at DESC
    `,
    params
  );

  return result.rows.map((row: { id: number; slug: string; guest_id: string; body: string; created_at: Date }) => ({
    id: adminLetterNotificationId(row.id),
    slugKey: row.slug,
    guestKey: row.guest_id,
    body: row.body,
    createdAt: row.created_at.toISOString()
  }));
}

/**
 * ゲストから管理人への便り一覧（管理者の通知バッジ用）。
 * 際限なく増え続けるのを避けるため直近分に絞る（十分な運用上のバッファを確保）。
 */
export async function listGuestLetterEvents(): Promise<GuestLetterEvent[]> {
  const pool = getDbPool();
  const result = await pool.query<{
    id: number;
    slug: string;
    guest_id: string;
    sender: string;
    body: string;
    created_at: Date;
  }>(
    `
    SELECT id, slug, guest_id, sender, body, created_at
    FROM letters
    WHERE sender_role = 'guest'
    ORDER BY created_at DESC
    LIMIT 2000
    `
  );

  return result.rows.map((row: {
    id: number;
    slug: string;
    guest_id: string;
    sender: string;
    body: string;
    created_at: Date;
  }) => ({
    id: guestLetterEventId(row.id),
    slugKey: row.slug,
    guestKey: row.guest_id,
    sender: row.sender,
    body: row.body,
    createdAt: row.created_at.toISOString()
  }));
}

async function markGuestAuthoredLettersReadForThread(slugKey: string, guestKey: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO letter_notification_reads (id, read_at)
    SELECT 'letter|' || id, NOW()
    FROM letters
    WHERE slug = $1 AND guest_id = $2 AND sender_role = 'guest'
    ON CONFLICT (id) DO NOTHING
    `,
    [slugKey, guestKey]
  );
}

/** ゲスト本人が文通モーダルを開いたとき、自分が送った便りの通知を一括既読にする */
export async function markGuestLetterNotificationsReadForThread(slug: string, guestId: string): Promise<void> {
  await markGuestAuthoredLettersReadForThread(normalizeThreadKey(slug), normalizeThreadKey(guestId));
}

/** 管理画面で文通スレッドを開いたとき、ゲスト発の未読ベル通知をすべて既読にする */
export async function markAllGuestLetterNotificationReadsForAdminThread(
  slugKey: string,
  guestKey: string
): Promise<void> {
  await markGuestAuthoredLettersReadForThread(normalizeThreadKey(slugKey), normalizeThreadKey(guestKey));
}

/** ゲスト本人が文通モーダルを開いたとき、そのスレッドの管理人発ベル通知（guest_notification_reads）を一括既読にする */
export async function markAdminLetterNotificationsReadForGuestThread(slug: string, guestId: string): Promise<void> {
  const slugKey = normalizeThreadKey(slug);
  const guestKey = normalizeThreadKey(guestId);
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO guest_notification_reads (guest_id, notification_id, read_at)
    SELECT $2, 'adminLetter|' || id, NOW()
    FROM letters
    WHERE slug = $1 AND guest_id = $2 AND sender_role = 'admin'
    ON CONFLICT (guest_id, notification_id) DO UPDATE SET read_at = EXCLUDED.read_at
    `,
    [slugKey, guestKey]
  );
}

/** 記事に紐づかない新規お手紙スレッドを作成して最初の便りを投函する（メタと本文を同一トランザクションで作成） */
export async function createStandaloneLetterThread(input: {
  guestId: string;
  title: string;
  letter: NewLetterInput;
}): Promise<{ slug: string; title: string; letters: Letter[] }> {
  const title = normalizeLetterTitle(input.title);
  if (!title) throw new Error("title_required");
  const slug = createStandaloneLetterSlug();
  const guestKey = normalizeThreadKey(input.guestId);
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO letter_thread_meta (slug, guest_id, title) VALUES ($1, $2, $3)`,
      [slug, guestKey, title]
    );
    const result = await client.query<LetterRow>(
      `
      INSERT INTO letters (slug, guest_id, sender, sender_role, body, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
      RETURNING id, sender, sender_role, body, created_at
      `,
      [slug, guestKey, input.letter.sender, input.letter.senderRole, input.letter.body, input.letter.createdAt]
    );
    await client.query("COMMIT");
    return { slug, title, letters: [mapLetterRow(result.rows[0]!)] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
