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
  console.error("DATABASE_URL または POSTGRES_URL を設定してください。");
  process.exit(1);
}

const replaceExisting = process.argv.includes("--replace");
const contentDir = path.join(process.cwd(), "content");
const files = (await readdir(contentDir))
  .filter((name) => name.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b, "ja"));

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  for (const file of files) {
    const slug = file.slice(0, -3);
    if (!slug || slug.length > 200 || /[\\/\0\r\n]/.test(slug) || slug === "." || slug === "..") {
      throw new Error(`Unsafe content filename: ${file}`);
    }

    const raw = await readFile(path.join(contentDir, file), "utf8");
    const result = await client.query(
      `
      INSERT INTO content_articles (slug, raw_markdown, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (slug) DO ${replaceExisting ? "UPDATE SET raw_markdown = EXCLUDED.raw_markdown, updated_at = NOW()" : "NOTHING"}
      `,
      [slug, raw]
    );
    console.log(`${result.rowCount === 1 ? "imported" : "skipped"}: ${file}`);
  }
} finally {
  await client.end();
}
