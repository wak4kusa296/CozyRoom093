import { getDbPool } from "@/lib/db";

export async function dbGetPushUploadBlob(
  filename: string
): Promise<{ data: Buffer; contentType: string } | null> {
  const pool = getDbPool();
  const result = await pool.query<{ data: Buffer; content_type: string }>(
    `SELECT data, content_type FROM push_upload_blobs WHERE filename = $1`,
    [filename]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { data: row.data, contentType: row.content_type };
}

export async function dbUpsertPushUploadBlob(filename: string, data: Buffer, contentType: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO push_upload_blobs (filename, data, content_type, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (filename) DO UPDATE SET
      data = EXCLUDED.data,
      content_type = EXCLUDED.content_type,
      updated_at = NOW()
    `,
    [filename, data, contentType]
  );
}
