import { createHmac } from "node:crypto";

type CredentialLookupPurpose = "guest" | "registration_gate";

const PEPPER_ENV_NAME = "CREDENTIAL_LOOKUP_PEPPER";
const SESSION_SECRET_ENV_NAME = "SESSION_SECRET";
const MIN_SECRET_LENGTH = 16;

export class CredentialLookupConfigurationError extends Error {
  constructor() {
    super(`${PEPPER_ENV_NAME} or a sufficiently long ${SESSION_SECRET_ENV_NAME} is required.`);
  }
}

/**
 * Returns a domain-separated keyed lookup digest.
 *
 * This supports an indexed candidate lookup only; the supplied secret still
 * must pass the salted scrypt verification before it is accepted.
 */
export function getCredentialLookupHash(phrase: string, purpose: CredentialLookupPurpose): string {
  const pepper = getCredentialLookupPepper();
  return createHmac("sha256", pepper)
    .update(`cozy-room:credential-lookup:v1:${purpose}:`)
    .update(phrase)
    .digest("hex");
}

function getCredentialLookupPepper(): Buffer {
  const configuredPepper = process.env[PEPPER_ENV_NAME]?.trim();
  if (configuredPepper) {
    if (configuredPepper.length < MIN_SECRET_LENGTH) throw new CredentialLookupConfigurationError();
    return Buffer.from(configuredPepper, "utf8");
  }

  const sessionSecret = process.env[SESSION_SECRET_ENV_NAME]?.trim();
  if (!sessionSecret || sessionSecret.length < MIN_SECRET_LENGTH) {
    throw new CredentialLookupConfigurationError();
  }

  return createHmac("sha256", sessionSecret)
    .update("cozy-room:credential-lookup-pepper:v1")
    .digest();
}
