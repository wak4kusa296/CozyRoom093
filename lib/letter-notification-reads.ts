import { getDbPool } from "@/lib/db";

export async function getLetterNotificationReads(): Promise<Record<string, string>> {
  const pool = getDbPool();
  const result = await pool.query<{ id: string; read_at: Date }>(
    `SELECT id, read_at FROM letter_notification_reads`
  );
  const out: Record<string, string> = {};
  for (const row of result.rows) {
    out[row.id] = row.read_at.toISOString();
  }
  return out;
}

export async function markLetterNotificationRead(id: string): Promise<boolean> {
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO letter_notification_reads (id, read_at)
    VALUES ($1, NOW())
    ON CONFLICT (id) DO NOTHING
    `,
    [id]
  );
  return true;
}
