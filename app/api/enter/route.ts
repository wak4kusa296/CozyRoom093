import { NextResponse } from "next/server";
import { AuthConfigurationError, authenticateGuest, createSession } from "@/lib/auth";
import { getRequestClientIp, rateLimitHeaders, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = takeRateLimit(`guest-login:${getRequestClientIp(request)}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) });
  }

  const body = (await request.json()) as { phrase?: string };
  const phrase = body.phrase?.trim() ?? "";

  try {
    const guest = await authenticateGuest(phrase);
    if (!guest) return NextResponse.json({ ok: false }, { status: 401 });

    await createSession(guest, "guest");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
    }
    console.error("[enter] authentication failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
