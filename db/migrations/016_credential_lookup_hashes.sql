-- Phase 4: keyed lookup hashes make candidate selection indexable without
-- replacing the salted scrypt verifier. Existing scrypt-only rows remain
-- nullable because their original phrases cannot be recovered for backfill.
-- They are handled by a temporary compatibility fallback in application code
-- until their credential or gate is next updated.

ALTER TABLE guest_credentials
  ADD COLUMN IF NOT EXISTS credential_lookup_hash TEXT;

ALTER TABLE registration_gates
  ADD COLUMN IF NOT EXISTS phrase_lookup_hash TEXT;

-- Preserve the previous "one active phrase" constraint without persisting a
-- plain phrase or exposing an unkeyed digest.
CREATE UNIQUE INDEX IF NOT EXISTS guest_credentials_lookup_hash_active_idx
  ON guest_credentials (credential_lookup_hash)
  WHERE is_active = TRUE AND credential_lookup_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS registration_gates_lookup_hash_active_idx
  ON registration_gates (phrase_lookup_hash)
  WHERE is_active = TRUE AND phrase_lookup_hash IS NOT NULL;
