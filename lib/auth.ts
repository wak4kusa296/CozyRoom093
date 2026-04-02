import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { findGuestByPhrase, isGuestCredentialActive, parseGuestCredentialsEnv } from "@/lib/guest-credentials";

const SESSION_COOKIE_NAME = "room_session";
const DEFAULT_SECRET = "room-development-secret";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

type SessionRole = "guest" | "admin";

export type SessionPayload = {
  guestId: string;
  guestName: string;
  role: SessionRole;
  exp: number;
};

export type Guest = {
  id: string;
  name: string;
  phrase: string;
};

function getSecret() {
  return process.env.SESSION_SECRET ?? DEFAULT_SECRET;
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

export async function authenticateGuest(phraseInput: string) {
  const phrase = phraseInput.trim();
  if (!phrase) return null;

  try {
    const guest = await findGuestByPhrase(phrase);
    if (guest) return guest;
    return null;
  } catch {
    // DB 利用不可時のみ env フォールバック
  }

  const envGuest = parseGuestCredentialsEnv().find((item) => item.phrase === phrase);
  if (!envGuest) return null;
  return {
    id: envGuest.guestId,
    name: envGuest.guestName,
    phrase: envGuest.phrase
  } satisfies Guest;
}

export async function enforceGuestSessionActiveOrRedirect() {
  const { redirect } = await import("next/navigation");
  const session = await getSession();
  if (!session || session.role !== "guest") return;
  const active = await getSessionOrRevokeIfGuestInactive();
  if (!active) redirect("/");
}

export function authenticateAdmin(secretInput: string) {
  const expected = process.env.ADMIN_SECRET ?? "Wkks.296";
  return secretInput.trim() === expected;
}

export async function createSession(guest: Guest, role: SessionRole = "guest") {
  const store = await cookies();
  const payload: SessionPayload = {
    guestId: guest.id,
    guestName: guest.name,
    role,
    exp: Date.now() + THIRTY_DAYS * 1000
  };

  store.set(SESSION_COOKIE_NAME, encode(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
    path: "/"
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  return decode(token);
}

/**
 * セッションがあれば返す。ゲストは台帳上も有効なときだけ。
 * 無効（削除済み等）なら Cookie を消して null。管理人はそのまま返す。
 */
export async function getSessionOrRevokeIfGuestInactive(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.role !== "guest") return session;
  const active = await isGuestCredentialActive(session.guestId);
  if (!active) {
    await clearSession();
    return null;
  }
  return session;
}

export async function requireGuestSession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export const adminStub: Guest = {
  id: "admin",
  name: "管理者",
  phrase: ""
};
