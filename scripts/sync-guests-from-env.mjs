/**
 * guest_credentials を空にしたあと、GUEST_PASSPHRASES から再投入する。
 * 使い方: DATABASE_URL=... node scripts/sync-guests-from-env.mjs
 */
import dotenv from "dotenv";
import pg from "pg";
import { resolveDatabaseUrl } from "./resolve-database-url.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.error("DATABASE_URL または POSTGRES_URL が未設定です。");
  process.exit(1);
}

function parseGuestCredentialsEnv() {
  const raw = process.env.GUEST_PASSPHRASES ?? "guest1:morningdew";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [name, phrase] = entry.split(":");
      const guestName = (name ?? `guest${index + 1}`).trim();
      const guestPhrase = (phrase ?? "").trim();
      return { guestId: guestName, guestName, phrase: guestPhrase };
    })
    .filter((item) => item.phrase.length > 0);
}

const items = parseGuestCredentialsEnv();
if (items.length === 0) {
  console.log("GUEST_PASSPHRASES に有効な行がありません。終了します。");
  process.exit(0);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN");
  for (const item of items) {
    await client.query(
      `
      INSERT INTO guest_credentials (guest_id, guest_name, phrase, is_active)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (guest_id)
      DO UPDATE SET
        guest_name = EXCLUDED.guest_name,
        phrase = EXCLUDED.phrase,
        updated_at = NOW()
      `,
      [item.guestId, item.guestName, item.phrase]
    );
  }
  await client.query("COMMIT");
  console.log(`guest_credentials を ${items.length} 件同期しました。`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
