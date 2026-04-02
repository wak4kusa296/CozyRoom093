import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/db";

export type RecoveryRequestRecord = {
  id: string;
  hintName: string;
  hintPlace: string;
  contactEmail: string;
  createdAt: string;
  readAt?: string | null;
};

function rowToRecord(row: {
  id: string;
  hint_name: string;
  hint_place: string;
  contact_email: string;
  created_at: Date;
  read_at: Date | null;
}): RecoveryRequestRecord {
  return {
    id: row.id,
    hintName: row.hint_name,
    hintPlace: row.hint_place,
    contactEmail: row.contact_email,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at ? row.read_at.toISOString() : null
  };
}

export async function listRecoveryRequests(): Promise<RecoveryRequestRecord[]> {
  const pool = getDbPool();
  const result = await pool.query<{
    id: string;
    hint_name: string;
    hint_place: string;
    contact_email: string;
    created_at: Date;
    read_at: Date | null;
  }>(`SELECT id, hint_name, hint_place, contact_email, created_at, read_at FROM recovery_requests ORDER BY created_at DESC`);
  return result.rows.map(rowToRecord);
}

export async function appendRecoveryRequest(
  hintName: string,
  hintPlace: string,
  contactEmail: string
): Promise<RecoveryRequestRecord> {
  const id = randomUUID();
  const pool = getDbPool();
  const createdAt = new Date();
  await pool.query(
    `
    INSERT INTO recovery_requests (id, hint_name, hint_place, contact_email, created_at, read_at)
    VALUES ($1::uuid, $2, $3, $4, $5, NULL)
    `,
    [id, hintName.trim(), hintPlace.trim(), contactEmail.trim(), createdAt]
  );
  return {
    id,
    hintName: hintName.trim(),
    hintPlace: hintPlace.trim(),
    contactEmail: contactEmail.trim(),
    createdAt: createdAt.toISOString(),
    readAt: null
  };
}

export async function getRecoveryRequestById(id: string): Promise<RecoveryRequestRecord | null> {
  const pool = getDbPool();
  const result = await pool.query<{
    id: string;
    hint_name: string;
    hint_place: string;
    contact_email: string;
    created_at: Date;
    read_at: Date | null;
  }>(`SELECT id, hint_name, hint_place, contact_email, created_at, read_at FROM recovery_requests WHERE id = $1::uuid`, [id]);
  const row = result.rows[0];
  return row ? rowToRecord(row) : null;
}

export async function markRecoveryRequestRead(id: string): Promise<boolean> {
  const pool = getDbPool();
  const result = await pool.query(
    `UPDATE recovery_requests SET read_at = NOW() WHERE id = $1::uuid AND read_at IS NULL`,
    [id]
  );
  if (result.rowCount && result.rowCount > 0) return true;
  const exists = await pool.query(`SELECT read_at FROM recovery_requests WHERE id = $1::uuid`, [id]);
  return Boolean(exists.rows[0]?.read_at);
}

export function countUnreadRecoveryRequests(items: RecoveryRequestRecord[]) {
  return items.filter((x) => !x.readAt).length;
}
