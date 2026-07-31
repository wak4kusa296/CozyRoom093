-- Phase 1 credential remediation:
-- Existing plaintext credentials are intentionally invalidated. This deployment
-- has no users, so administrators must seed new credentials after migration.

DROP INDEX IF EXISTS guest_credentials_phrase_active_idx;
DROP INDEX IF EXISTS registration_gates_phrase_active_idx;

DELETE FROM registration_gates;
DELETE FROM guest_credentials;

ALTER TABLE guest_credentials
  ADD COLUMN IF NOT EXISTS credential_hash TEXT;
ALTER TABLE guest_credentials
  ALTER COLUMN credential_hash SET NOT NULL;
ALTER TABLE guest_credentials
  DROP COLUMN IF EXISTS phrase;

ALTER TABLE registration_gates
  ADD COLUMN IF NOT EXISTS phrase_hash TEXT;
ALTER TABLE registration_gates
  ALTER COLUMN phrase_hash SET NOT NULL;
ALTER TABLE registration_gates
  DROP COLUMN IF EXISTS phrase;
