import { NextResponse } from "next/server";
import { isActivePhraseTaken } from "@/lib/guest-credentials";
import {
  isValidSecretPhrase,
  SECRET_PHRASE_WHITESPACE_MESSAGE,
  secretPhraseContainsWhitespace
} from "@/lib/passphrase-rules";
import { PHRASE_TAKEN_MESSAGE } from "@/lib/signup-email-template";
import { getRequestClientIp, rateLimitHeaders, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = takeRateLimit(`phrase-check:${getRequestClientIp(request)}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) });
  }

  const body = (await request.json()) as { phrase?: string };
  const phrase = String(body.phrase ?? "");

  if (!phrase) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  if (secretPhraseContainsWhitespace(phrase) || !isValidSecretPhrase(phrase)) {
    return NextResponse.json({
      ok: true,
      available: false,
      message: SECRET_PHRASE_WHITESPACE_MESSAGE
    });
  }

  let taken: boolean;
  try {
    taken = await isActivePhraseTaken(phrase);
  } catch (error) {
    console.error("[join/check-phrase] lookup failed", error);
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }
  if (taken) {
    return NextResponse.json({
      ok: true,
      available: false,
      message: PHRASE_TAKEN_MESSAGE
    });
  }

  return NextResponse.json({ ok: true, available: true });
}
