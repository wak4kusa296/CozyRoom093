import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { Client } from "pg";
import dotenv from "dotenv";
import { resolveDatabaseUrl } from "../scripts/resolve-database-url.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  throw new Error("DATABASE_URL または POSTGRES_URL が未設定です。 .env.local を確認してください。");
}

const client = new Client({ connectionString: databaseUrl });

test.before(async () => {
  await client.connect();
});

test.after(async () => {
  await client.end();
});

test("DB接続できる", async () => {
  const result = await client.query("SELECT 1 AS one");
  assert.equal(result.rows[0]?.one, 1);
});

test("guest_credentialsに書き込みできる", async () => {
  await client.query("BEGIN");
  try {
    const inserted = await client.query(
      `
      INSERT INTO guest_credentials (guest_id, guest_name, phrase, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (guest_id)
      DO UPDATE SET guest_name = EXCLUDED.guest_name, phrase = EXCLUDED.phrase, is_active = TRUE
      RETURNING guest_id, guest_name, phrase
      `,
      ["db-test-guest", "DB Test", "db-test-phrase"]
    );

    assert.equal(inserted.rowCount, 1);
    assert.equal(inserted.rows[0]?.guest_id, "db-test-guest");
    assert.equal(inserted.rows[0]?.guest_name, "DB Test");
    assert.equal(inserted.rows[0]?.phrase, "db-test-phrase");
  } finally {
    await client.query("ROLLBACK");
  }
});
