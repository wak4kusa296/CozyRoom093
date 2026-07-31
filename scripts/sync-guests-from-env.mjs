/**
 * GUEST_PASSPHRASES から guest_credentials に scrypt ハッシュを同期する。
 * 使い方: DATABASE_URL=... node scripts/sync-guests-from-env.mjs
 */
import dotenv from "dotenv";
import pg from "pg";
import { createHmac, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { resolveDatabaseUrl } from "./resolve-database-url.mjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.error("DATABASE_URL または POSTGRES_URL が未設定です。");
  process.exit(1);
}

function parseGuestCredentialsEnv() {
  const raw = process.env.GUEST_PASSPHRASES ?? "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const parts = entry.split(":").map((part) => part.trim());
      const hasExplicitId = parts.length >= 3;
      const guestId = (parts[0] ?? `guest${index + 1}`).trim();
      const guestName = (hasExplicitId ? parts[1] : parts[0] ?? `guest${index + 1}`).trim();
      const guestPhrase = (hasExplicitId ? parts.slice(2).join(":") : parts[1] ?? "").trim();
      return { guestId, guestName, phrase: guestPhrase };
    })
    .filter((item) => item.guestId.length > 0 && item.guestName.length > 0 && item.phrase.length > 0);
}

const scrypt = promisify(scryptCallback);
async function hashSecret(secret) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(secret, salt, 32);
  return `scrypt$16384$8$1$32$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

function getCredentialLookupHash(phrase) {
  const configuredPepper = process.env.CREDENTIAL_LOOKUP_PEPPER?.trim();
  if (configuredPepper) {
    if (configuredPepper.length < 16) {
      throw new Error("CREDENTIAL_LOOKUP_PEPPER は16文字以上必要です。");
    }
    return createHmac("sha256", configuredPepper)
      .update("cozy-room:credential-lookup:v1:guest:")
      .update(phrase)
      .digest("hex");
  }

  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!sessionSecret || sessionSecret.length < 16) {
    throw new Error("CREDENTIAL_LOOKUP_PEPPER または16文字以上の SESSION_SECRET が必要です。");
  }
  const derivedPepper = createHmac("sha256", sessionSecret)
    .update("cozy-room:credential-lookup-pepper:v1")
    .digest();
  return createHmac("sha256", derivedPepper)
    .update("cozy-room:credential-lookup:v1:guest:")
    .update(phrase)
    .digest("hex");
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
      INSERT INTO guest_credentials (
        guest_id, guest_name, credential_hash, is_active, credential_lookup_hash
      )
      VALUES ($1, $2, $3, TRUE, $4)
      ON CONFLICT (guest_id)
      DO UPDATE SET
        guest_name = EXCLUDED.guest_name,
        credential_hash = EXCLUDED.credential_hash,
        credential_lookup_hash = EXCLUDED.credential_lookup_hash,
        updated_at = NOW()
      `,
      [
        item.guestId,
        item.guestName,
        await hashSecret(item.phrase),
        getCredentialLookupHash(item.phrase)
      ]
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
