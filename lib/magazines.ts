import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/db";

export type Magazine = {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
};

function normalizeName(value: string) {
  return value.trim();
}

function normalizeDescription(value: string) {
  return value.trim();
}

function rowToMagazine(row: {
  id: string;
  name: string;
  description: string;
  thumbnail: string | null;
}): Magazine {
  return {
    id: row.id,
    name: normalizeName(row.name),
    description: normalizeDescription(row.description ?? ""),
    ...(row.thumbnail ? { thumbnail: row.thumbnail } : {})
  };
}

export async function listMagazines() {
  const pool = getDbPool();
  const result = await pool.query<{
    id: string;
    name: string;
    description: string;
    thumbnail: string | null;
  }>(`SELECT id, name, description, thumbnail FROM magazines ORDER BY name ASC`);
  return result.rows.map(rowToMagazine);
}

export async function getFirstRegisteredMagazineThumbnail(): Promise<string | undefined> {
  const pool = getDbPool();
  const result = await pool.query<{ thumbnail: string }>(
    `SELECT thumbnail FROM magazines WHERE thumbnail IS NOT NULL AND thumbnail <> '' ORDER BY created_at ASC LIMIT 1`
  );
  const t = result.rows[0]?.thumbnail?.trim();
  return t || undefined;
}

async function ensureUniqueName(name: string, skipId?: string) {
  const pool = getDbPool();
  const normalizedName = normalizeName(name);
  const result = await pool.query<{ id: string }>(
    `
    SELECT id FROM magazines
    WHERE LOWER(name) = LOWER($1) AND ($2::uuid IS NULL OR id <> $2::uuid)
    LIMIT 1
    `,
    [normalizedName, skipId ?? null]
  );
  if (result.rows.length > 0) {
    throw new Error("Magazine name must be unique");
  }
}

export async function addMagazine(input: { name: string; description?: string; thumbnail?: string }) {
  const name = normalizeName(input.name);
  const description = normalizeDescription(input.description ?? "");
  if (!name) {
    throw new Error("Magazine name is required");
  }
  await ensureUniqueName(name);
  const id = randomUUID();
  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO magazines (id, name, description, thumbnail)
    VALUES ($1::uuid, $2, $3, $4)
    `,
    [id, name, description, typeof input.thumbnail === "string" && input.thumbnail ? input.thumbnail : null]
  );
  return rowToMagazine({
    id,
    name,
    description,
    thumbnail: typeof input.thumbnail === "string" && input.thumbnail ? input.thumbnail : null
  });
}

export async function updateMagazine(input: { id: string; name: string; description?: string; thumbnail?: string }) {
  const id = String(input.id);
  const name = normalizeName(input.name);
  const description = normalizeDescription(input.description ?? "");
  if (!id || !name) {
    throw new Error("Magazine id and name are required");
  }
  await ensureUniqueName(name, id);

  const pool = getDbPool();
  const thumb =
    input.thumbnail === undefined
      ? undefined
      : input.thumbnail === "" || input.thumbnail == null
        ? null
        : input.thumbnail;
  if (thumb === undefined) {
    await pool.query(`UPDATE magazines SET name = $2, description = $3 WHERE id = $1::uuid`, [id, name, description]);
  } else {
    await pool.query(
      `UPDATE magazines SET name = $2, description = $3, thumbnail = $4 WHERE id = $1::uuid`,
      [id, name, description, thumb]
    );
  }
}

export async function deleteMagazine(id: string) {
  const pool = getDbPool();
  await pool.query(`DELETE FROM magazines WHERE id = $1::uuid`, [id]);
}
