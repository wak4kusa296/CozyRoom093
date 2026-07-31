import { getDbPool } from "@/lib/db";
import type { Guest } from "@/lib/auth";
import { getCredentialLookupHash } from "@/lib/credential-lookup";
import { hashSecret, verifySecret } from "@/lib/secret-hash";

export type GuestCredential = {
  guestId: string;
  guestName: string;
  isActive: boolean;
  /** 管理人だけが見るメモ。ゲスト向け画面・APIには出さない */
  adminMemo: string;
};

export function parseGuestCredentialsEnv() {
  const raw = process.env.GUEST_PASSPHRASES ?? "";
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
        phrase: guestPhrase
      };
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
    is_active: boolean;
    admin_memo: string | null;
  }>(`
    SELECT guest_id, guest_name, is_active, admin_memo
    FROM guest_credentials
    ORDER BY guest_id ASC
  `);

  return result.rows.map((row) => ({
    guestId: row.guest_id,
    guestName: row.guest_name,
    isActive: row.is_active,
    adminMemo: row.admin_memo ?? ""
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
        INSERT INTO guest_credentials (
          guest_id, guest_name, credential_hash, is_active, credential_lookup_hash
        )
        VALUES ($1, $2, $3, TRUE, $4)
        ON CONFLICT (guest_id) DO NOTHING
        `,
        [
          item.guestId,
          item.guestName,
          await hashSecret(item.phrase),
          getCredentialLookupHash(item.phrase, "guest")
        ]
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

    return false;
  } catch {
    return false;
  }
}

export function buildGuestIdFromNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

/** 有効アカウントが同じ秘密の言葉を使っているか */
export async function isActivePhraseTaken(phraseInput: string): Promise<boolean> {
  const phrase = phraseInput.trim();
  if (!phrase) return false;
  const guest = await findGuestByPhrase(phrase);
  return guest !== null;
}

export async function findGuestByPhrase(phraseInput: string): Promise<Guest | null> {
  const phrase = phraseInput.trim();
  if (!phrase) return null;

  const pool = getDbPool();
  const lookupHash = getCredentialLookupHash(phrase, "guest");
  const result = await pool.query<{
    guest_id: string;
    guest_name: string;
    credential_hash: string;
  }>(
    `
    SELECT guest_id, guest_name, credential_hash
    FROM guest_credentials
    WHERE is_active = TRUE AND credential_lookup_hash = $1
    `,
    [lookupHash]
  );

  for (const row of result.rows) {
    if (await verifySecret(phrase, row.credential_hash)) {
      return { id: row.guest_id, name: row.guest_name };
    }
  }

  // Rows written before migration 016 cannot be backfilled because their
  // salted scrypt hashes intentionally contain no recoverable phrase.
  const legacyResult = await pool.query<{
    guest_id: string;
    guest_name: string;
    credential_hash: string;
  }>(`
    SELECT guest_id, guest_name, credential_hash
    FROM guest_credentials
    WHERE is_active = TRUE AND credential_lookup_hash IS NULL
  `);
  for (const row of legacyResult.rows) {
    if (await verifySecret(phrase, row.credential_hash)) {
      return { id: row.guest_id, name: row.guest_name };
    }
  }
  return null;
}

/**
 * 新規ゲストを挿入する。有効 phrase の重複時は phrase_taken。
 * guest_id 衝突時は短いリトライを呼ぶ側で行う想定。
 */
export async function insertGuestCredential(input: {
  guestId: string;
  guestName: string;
  phrase: string;
  adminMemo?: string;
}): Promise<"ok" | "phrase_taken" | "id_taken"> {
  const guestId = input.guestId.trim();
  const guestName = input.guestName.trim();
  const phrase = input.phrase.trim();
  const adminMemo = (input.adminMemo ?? "").trim();
  if (!guestId || !guestName || !phrase) return "phrase_taken";

  if (await isActivePhraseTaken(phrase)) return "phrase_taken";

  const pool = getDbPool();
  try {
    await pool.query(
      `
      INSERT INTO guest_credentials (
        guest_id, guest_name, credential_hash, is_active, admin_memo, credential_lookup_hash
      )
      VALUES ($1, $2, $3, TRUE, $4, $5)
      `,
      [guestId, guestName, await hashSecret(phrase), adminMemo, getCredentialLookupHash(phrase, "guest")]
    );
    return "ok";
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "23505") {
      const taken = await isActivePhraseTaken(phrase);
      return taken ? "phrase_taken" : "id_taken";
    }
    throw e;
  }
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
    INSERT INTO guest_credentials (guest_id, guest_name, credential_hash, is_active, credential_lookup_hash)
    VALUES ($1, $2, $3, TRUE, $4)
    ON CONFLICT (guest_id)
    DO UPDATE SET
      guest_name = EXCLUDED.guest_name,
      credential_hash = EXCLUDED.credential_hash,
      credential_lookup_hash = EXCLUDED.credential_lookup_hash,
      updated_at = NOW()
    `,
    [guestId, guestName, await hashSecret(phrase), getCredentialLookupHash(phrase, "guest")]
  );
}

export async function updateGuestPhrase(guestIdInput: string, phraseInput: string): Promise<boolean> {
  const guestId = guestIdInput.trim();
  const phrase = phraseInput.trim();
  if (!guestId || !phrase) return false;

  const pool = getDbPool();
  const result = await pool.query(
    `
    UPDATE guest_credentials
    SET credential_hash = $2, credential_lookup_hash = $3, updated_at = NOW()
    WHERE guest_id = $1
    `,
    [guestId, await hashSecret(phrase), getCredentialLookupHash(phrase, "guest")]
  );
  return Boolean(result.rowCount);
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

export async function updateGuestAdminMemo(guestIdInput: string, adminMemoInput: string) {
  const guestId = guestIdInput.trim();
  if (!guestId) return;

  const pool = getDbPool();
  await pool.query(
    `
    UPDATE guest_credentials
    SET admin_memo = $2, updated_at = NOW()
    WHERE guest_id = $1
    `,
    [guestId, adminMemoInput.trim()]
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
