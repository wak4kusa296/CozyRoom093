import { NextResponse } from "next/server";
import {
  HANDWRITTEN_PASSWORD_INVALID_MESSAGE,
  isValidHandwrittenPassword
} from "@/lib/passphrase-rules";
import { findActiveRegistrationGateByPhrase } from "@/lib/registration-gates";
import { getRequestClientIp, rateLimitHeaders, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = takeRateLimit(`gate-check:${getRequestClientIp(request)}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) });
  }

  const body = (await request.json()) as { gatePhrase?: string };
  const gatePhrase = String(body.gatePhrase ?? "").trim();

  if (!gatePhrase) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  if (!isValidHandwrittenPassword(gatePhrase)) {
    return NextResponse.json(
      { ok: false, error: "invalid_gate_format", message: HANDWRITTEN_PASSWORD_INVALID_MESSAGE },
      { status: 400 }
    );
  }

  let gate;
  try {
    gate = await findActiveRegistrationGateByPhrase(gatePhrase);
  } catch (error) {
    console.error("[join/check-gate] lookup failed", error);
    return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
  }
  if (!gate) {
    return NextResponse.json(
      { ok: false, error: "invalid_gate", message: "手書きのパスワードが違うか、無効になっています。" },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true });
}
