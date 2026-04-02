import { getDbPool } from "@/lib/db";
import type { Guest } from "@/lib/auth";

export type GuestCredential = {
  guestId: string;
  guestName: string;
  phrase: string;
  isActive: boolean;
};

export function parseGuestCredentialsEnv() {
  const raw = process.env.GUEST_PASSPHRASES ?? "guest1:morningdew";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [name, phrase] = entry.split(":");
      const guestName = (name ?? `guest${index + 1}`).trim();
      const guestPhrase = (phrase ?? "").trim();
      return {
        guestId: guestName,
        guestName,
        phrase: guestPhrase,
        isActive: true
      } satisfies GuestCredential;
    })
    .filter((item) => item.phrase.length > 0);
}

export async function listGuestCredentials() {
  const all = await listGuestCredentialsWithStatus();
  return all.filter((item) => item.isActive);
}

/**
 * 台帳登録時刻（通知の「アカウントより前」を切る基準）。
 * DB の `timestamptz` を UTC の ISO8601 で返す。日本時刻に直す必要は比較上ない（瞬間は一意）。
 * 行が無い・未移行時は null。
 */
export async function getGuestAccountStartedAtIso(guestIdInput: string): Promise<string | null> {
  const guestId = guestIdInput.trim();
  if (!guestId) return null;
  try {
    const pool = getDbPool();
    const result = await pool.query<{ t: Date | null }>(
      `SELECT COALESCE(created_at, updated_at) AS t FROM guest_credentials WHERE guest_id = $1`,
      [guestId]
    );
    const row = result.rows[0];
    if (!row?.t) return null;
    return row.t.toISOString();
  } catch {
    return null;
  }
}

export async function listGuestCredentialsWithStatus() {
  const pool = getDbPool();
  const result = await pool.query<{
    guest_id: string;
    guest_name: string;
    phrase: string;
    is_active: boolean;
  }>(`
    SELECT guest_id, guest_name, phrase, is_active
    FROM guest_credentials
    ORDER BY guest_id ASC
  `);

  return result.rows.map((row) => ({
    guestId: row.guest_id,
    guestName: row.guest_name,
    phrase: row.phrase,
    isActive: row.is_active
  }));
}

export async function syncGuestCredentialsFromEnv() {
  const items = parseGuestCredentialsEnv();
  if (items.length === 0) return;

  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      const suppressed = await client.query(`SELECT 1 FROM guest_env_sync_suppress WHERE guest_id = $1`, [
        item.guestId
      ]);
      if (suppressed.rowCount) continue;

      await client.query(
        `
        INSERT INTO guest_credentials (guest_id, guest_name, phrase, is_active, created_at)
        VALUES ($1, $2, $3, TRUE, NOW())
        ON CONFLICT (guest_id) DO NOTHING
        `,
        [item.guestId, item.guestName, item.phrase]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** 台帳の guest_id で秘密の言葉を取得（再発行メール送信用。呼び名ヒントとは無関係） */
export async function getPassphraseByGuestId(guestIdInput: string): Promise<string | null> {
  const guestId = guestIdInput.trim();
  if (!guestId) return null;

  const pool = getDbPool();
  const result = await pool.query<{ phrase: string }>(
    `
    SELECT phrase
    FROM guest_credentials
    WHERE is_active = TRUE AND guest_id = $1
    LIMIT 1
    `,
    [guestId]
  );

  return result.rows[0]?.phrase ?? null;
}

export async function isGuestCredentialActive(guestIdInput: string): Promise<boolean> {
  const id = guestIdInput.trim();
  if (!id) return false;
  try {
    const pool = getDbPool();
    const result = await pool.query<{ is_active: boolean }>(
      `SELECT is_active FROM guest_credentials WHERE guest_id = $1 LIMIT 1`,
      [id]
    );
    const row = result.rows[0];
    if (row) return row.is_active;

    // 台帳に行がない = 削除済み、または env からまだ INSERT されていないだけ
    const suppressed = await pool.query(`SELECT 1 FROM guest_env_sync_suppress WHERE guest_id = $1 LIMIT 1`, [id]);
    if (suppressed.rowCount) return false;

    const envGuest = parseGuestCredentialsEnv().find((g) => g.guestId === id);
    return !!envGuest && envGuest.isActive;
  } catch {
    // DB 利用不可時は env に載っている ID のみ継続を認める（従来の緩和）
    const envGuest = parseGuestCredentialsEnv().find((g) => g.guestId === id);
    if (envGuest) return envGuest.isActive;
    return true;
  }
}

export async function findGuestByPhrase(phraseInput: string): Promise<Guest | null> {
  const phrase = phraseInput.trim();
  if (!phrase) return null;

  const pool = getDbPool();
  const result = await pool.query<{
    guest_id: string;
    guest_name: string;
    phrase: string;
  }>(
    `
    SELECT guest_id, guest_name, phrase
    FROM guest_credentials
    WHERE phrase = $1 AND is_active = TRUE
    LIMIT 1
    `,
    [phrase]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.guest_id,
    name: row.guest_name,
    phrase: row.phrase
  };
}

export async function upsertGuestCredential(input: {
  guestId: string;
  guestName: string;
  phrase: string;
}) {
  const guestId = input.guestId.trim();
  const guestName = input.guestName.trim();
  const phrase = input.phrase.trim();
  if (!guestId || !guestName || !phrase) return;

  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO guest_credentials (guest_id, guest_name, phrase, is_active, created_at)
    VALUES ($1, $2, $3, TRUE, NOW())
    ON CONFLICT (guest_id)
    DO UPDATE SET
      guest_name = EXCLUDED.guest_name,
      phrase = EXCLUDED.phrase,
      updated_at = NOW()
    `,
    [guestId, guestName, phrase]
  );
}

export async function updateGuestPhrase(guestIdInput: string, phraseInput: string) {
  const guestId = guestIdInput.trim();
  const phrase = phraseInput.trim();
  if (!guestId || !phrase) return;

  const pool = getDbPool();
  await pool.query(
    `
    UPDATE guest_credentials
    SET phrase = $2, updated_at = NOW()
    WHERE guest_id = $1
    `,
    [guestId, phrase]
  );
}

export async function updateGuestName(guestIdInput: string, guestNameInput: string) {
  const guestId = guestIdInput.trim();
  const guestName = guestNameInput.trim();
  if (!guestId || !guestName) return;

  const pool = getDbPool();
  await pool.query(
    `
    UPDATE guest_credentials
    SET guest_name = $2, updated_at = NOW()
    WHERE guest_id = $1
    `,
    [guestId, guestName]
  );
}

export async function setGuestActive(guestIdInput: string, isActive: boolean) {
  const guestId = guestIdInput.trim();
  if (!guestId) return;

  const pool = getDbPool();
  await pool.query(
    `
    UPDATE guest_credentials
    SET is_active = $2, updated_at = NOW()
    WHERE guest_id = $1
    `,
    [guestId, isActive]
  );
}

/** letters テーブルと同じ正規化（ファイル時代のスレッドキーと一致） */
function normalizeGuestKeyForLetters(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * ユーザーを台帳から削除し、関連データを消す。
 * 管理人用の admin スタブ ID は削除しない。
 */
export async function deleteGuestCredential(guestIdInput: string): Promise<boolean> {
  const guestId = guestIdInput.trim();
  if (!guestId) return false;
  if (guestId === "admin") return false;

  const pool = getDbPool();
  const letterGuestKey = normalizeGuestKeyForLetters(guestId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query(`SELECT 1 FROM guest_credentials WHERE guest_id = $1`, [guestId]);
    if (!exists.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query(`DELETE FROM letters WHERE guest_id = $1 OR guest_id = $2`, [guestId, letterGuestKey]);
    await client.query(`DELETE FROM push_subscriptions WHERE guest_id = $1`, [guestId]);
    await client.query(`DELETE FROM guest_notification_reads WHERE guest_id = $1`, [guestId]);

    await client.query(
      `
      UPDATE hearts SET
        total = GREATEST(0, total - COALESCE((by_guest->>$1)::int, 0)),
        by_guest = by_guest - $1::text
      WHERE by_guest ? $1
      `,
      [guestId]
    );

    await client.query(
      `
      UPDATE broadcast_pushes SET guest_ids = array_remove(guest_ids, $1)
      WHERE audience = 'selected' AND $1 = ANY(guest_ids)
      `,
      [guestId]
    );

    await client.query(`DELETE FROM guest_credentials WHERE guest_id = $1`, [guestId]);

    await client.query(
      `INSERT INTO guest_env_sync_suppress (guest_id) VALUES ($1) ON CONFLICT (guest_id) DO NOTHING`,
      [guestId]
    );

    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
