import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/db";

export type SignupNotificationRecord = {
  id: string;
  guestId: string;
  guestName: string;
  memo: string;
  emailSent: boolean;
  createdAt: string;
  readAt?: string | null;
};

function rowToRecord(row: {
  id: string;
  guest_id: string;
  guest_name: string;
  memo: string;
  email_sent: boolean;
  created_at: Date;
  read_at: Date | null;
}): SignupNotificationRecord {
  return {
    id: row.id,
    guestId: row.guest_id,
    guestName: row.guest_name,
    memo: row.memo,
    emailSent: row.email_sent,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at ? row.read_at.toISOString() : null
  };
}

export async function listSignupNotifications(): Promise<SignupNotificationRecord[]> {
  const pool = getDbPool();
  const result = await pool.query<{
    id: string;
    guest_id: string;
    guest_name: string;
    memo: string;
    email_sent: boolean;
    created_at: Date;
    read_at: Date | null;
  }>(`
    SELECT id, guest_id, guest_name, memo, email_sent, created_at, read_at
    FROM signup_notifications
    ORDER BY created_at DESC
  `);
  return result.rows.map(
    (row: {
      id: string;
      guest_id: string;
      guest_name: string;
      memo: string;
      email_sent: boolean;
      created_at: Date;
      read_at: Date | null;
    }) => rowToRecord(row)
  );
}

export async function appendSignupNotification(input: {
  guestId: string;
  guestName: string;
  memo: string;
  emailSent: boolean;
}): Promise<SignupNotificationRecord> {
  const id = randomUUID();
  const pool = getDbPool();
  const createdAt = new Date();
  await pool.query(
    `
    INSERT INTO signup_notifications (id, guest_id, guest_name, memo, email_sent, created_at, read_at)
    VALUES ($1::uuid, $2, $3, $4, $5, $6, NULL)
    `,
    [id, input.guestId.trim(), input.guestName.trim(), input.memo.trim(), input.emailSent, createdAt]
  );
  return {
    id,
    guestId: input.guestId.trim(),
    guestName: input.guestName.trim(),
    memo: input.memo.trim(),
    emailSent: input.emailSent,
    createdAt: createdAt.toISOString(),
    readAt: null
  };
}

export async function markSignupNotificationRead(id: string): Promise<boolean> {
  const pool = getDbPool();
  const result = await pool.query(
    `UPDATE signup_notifications SET read_at = NOW() WHERE id = $1::uuid AND read_at IS NULL`,
    [id]
  );
  if (result.rowCount && result.rowCount > 0) return true;
  const exists = await pool.query(`SELECT read_at FROM signup_notifications WHERE id = $1::uuid`, [id]);
  return Boolean(exists.rows[0]?.read_at);
}

export function countUnreadSignupNotifications(items: SignupNotificationRecord[]) {
  return items.filter((x) => !x.readAt).length;
}
