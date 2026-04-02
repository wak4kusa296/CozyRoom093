import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";
import dotenv from "dotenv";
import { resolveDatabaseUrl } from "./resolve-database-url.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.error(
    "データベース URL が未設定です。DATABASE_URL または POSTGRES_URL を .env.local 等に設定してください。"
  );
  process.exit(1);
}

const migrationsDir = path.join(process.cwd(), "db", "migrations");
const client = new Client({ connectionString: databaseUrl });

await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
  for (const file of files) {
    const existing = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (existing.rowCount) continue;

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`applied: ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log("db migration completed");
} finally {
  await client.end();
}
