import { getDbPool } from "@/lib/db";
import { getCredentialLookupHash } from "@/lib/credential-lookup";
import { isValidHandwrittenPassword } from "@/lib/passphrase-rules";
import { hashSecret, verifySecret } from "@/lib/secret-hash";

export type RegistrationGate = {
  gateId: string;
  label: string;
  isActive: boolean;
};

export function buildGateIdFromNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `gate-${yyyy}${mm}${dd}${hh}${mi}${ss}`;
}

export async function listRegistrationGates(): Promise<RegistrationGate[]> {
  const pool = getDbPool();
  const result = await pool.query<{
    gate_id: string;
    label: string;
    is_active: boolean;
  }>(`
    SELECT gate_id, label, is_active
    FROM registration_gates
    ORDER BY created_at DESC
  `);
  return result.rows.map(
    (row: { gate_id: string; label: string; is_active: boolean }) => ({
      gateId: row.gate_id,
      label: row.label,
      isActive: row.is_active
    })
  );
}

export async function findActiveRegistrationGateByPhrase(phraseInput: string): Promise<RegistrationGate | null> {
  const phrase = phraseInput.trim();
  if (!phrase) return null;

  const pool = getDbPool();
  const lookupHash = getCredentialLookupHash(phrase, "registration_gate");
  const result = await pool.query<{
    gate_id: string;
    phrase_hash: string;
    label: string;
    is_active: boolean;
  }>(
    `
    SELECT gate_id, phrase_hash, label, is_active
    FROM registration_gates
    WHERE is_active = TRUE AND phrase_lookup_hash = $1
    `,
    [lookupHash]
  );
  for (const row of result.rows) {
    if (await verifySecret(phrase, row.phrase_hash)) {
      return { gateId: row.gate_id, label: row.label, isActive: row.is_active };
    }
  }

  // Hash-only rows predating migration 016 cannot be indexed without their
  // original phrase. Retain this fallback until each gate is updated.
  const legacyResult = await pool.query<{
    gate_id: string;
    phrase_hash: string;
    label: string;
    is_active: boolean;
  }>(`
    SELECT gate_id, phrase_hash, label, is_active
    FROM registration_gates
    WHERE is_active = TRUE AND phrase_lookup_hash IS NULL
  `);
  for (const row of legacyResult.rows) {
    if (await verifySecret(phrase, row.phrase_hash)) {
      return { gateId: row.gate_id, label: row.label, isActive: row.is_active };
    }
  }
  return null;
}

export async function upsertRegistrationGate(input: {
  gateId: string;
  phrase: string;
  label?: string;
}): Promise<"ok" | "invalid_phrase"> {
  const gateId = input.gateId.trim();
  const phrase = input.phrase.trim();
  const label = (input.label ?? "").trim();
  if (!gateId || !phrase) return "invalid_phrase";
  if (!isValidHandwrittenPassword(phrase)) return "invalid_phrase";

  const pool = getDbPool();
  await pool.query(
    `
    INSERT INTO registration_gates (gate_id, phrase_hash, label, is_active, phrase_lookup_hash)
    VALUES ($1, $2, $3, TRUE, $4)
    ON CONFLICT (gate_id)
    DO UPDATE SET
      phrase_hash = EXCLUDED.phrase_hash,
      phrase_lookup_hash = EXCLUDED.phrase_lookup_hash,
      label = EXCLUDED.label,
      updated_at = NOW()
    `,
    [gateId, await hashSecret(phrase), label, getCredentialLookupHash(phrase, "registration_gate")]
  );
  return "ok";
}

export async function updateRegistrationGatePhrase(
  gateIdInput: string,
  phraseInput: string
): Promise<"ok" | "invalid_phrase"> {
  const gateId = gateIdInput.trim();
  const phrase = phraseInput.trim();
  if (!gateId || !phrase) return "invalid_phrase";
  if (!isValidHandwrittenPassword(phrase)) return "invalid_phrase";

  const pool = getDbPool();
  await pool.query(
    `
    UPDATE registration_gates
    SET phrase_hash = $2, phrase_lookup_hash = $3, updated_at = NOW()
    WHERE gate_id = $1
    `,
    [gateId, await hashSecret(phrase), getCredentialLookupHash(phrase, "registration_gate")]
  );
  return "ok";
}

export async function updateRegistrationGateLabel(gateIdInput: string, labelInput: string): Promise<void> {
  const gateId = gateIdInput.trim();
  if (!gateId) return;

  const pool = getDbPool();
  await pool.query(
    `
    UPDATE registration_gates
    SET label = $2, updated_at = NOW()
    WHERE gate_id = $1
    `,
    [gateId, labelInput.trim()]
  );
}

export async function setRegistrationGateActive(gateIdInput: string, isActive: boolean): Promise<void> {
  const gateId = gateIdInput.trim();
  if (!gateId) return;

  const pool = getDbPool();
  await pool.query(
    `
    UPDATE registration_gates
    SET is_active = $2, updated_at = NOW()
    WHERE gate_id = $1
    `,
    [gateId, isActive]
  );
}

export async function deleteRegistrationGate(gateIdInput: string): Promise<boolean> {
  const gateId = gateIdInput.trim();
  if (!gateId) return false;

  const pool = getDbPool();
  const result = await pool.query(`DELETE FROM registration_gates WHERE gate_id = $1`, [gateId]);
  return Boolean(result.rowCount && result.rowCount > 0);
}
