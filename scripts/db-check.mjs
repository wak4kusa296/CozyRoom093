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

const url = new URL(databaseUrl);
console.log("接続先:");
console.log(`  host     : ${url.hostname}`);
console.log(`  database : ${url.pathname.replace(/^\//, "")}`);
console.log(`  user     : ${url.username}`);
console.log(`  sslmode  : ${url.searchParams.get("sslmode") ?? "(未指定)"}`);

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  const version = await client.query("SELECT version()");
  console.log(`  server   : ${version.rows[0].version.split(",")[0]}`);

  const migrations = await client.query(
    "SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1"
  );
  console.log(`\n最新マイグレーション: ${migrations.rows[0]?.name ?? "(未適用)"}`);

  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log("\n行数:");
  for (const { table_name: table } of tables.rows) {
    const count = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    console.log(`  ${table.padEnd(32)} ${count.rows[0].n}`);
  }
} finally {
  await client.end();
}
