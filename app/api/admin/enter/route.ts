import { NextResponse } from "next/server";
import { adminStub, AuthConfigurationError, authenticateAdmin, createSession } from "@/lib/auth";
import { getRequestClientIp, rateLimitHeaders, takeRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = takeRateLimit(`admin-login:${getRequestClientIp(request)}`, 5, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) });
  }

  const body = (await request.json()) as { secret?: string };
  try {
    const ok = authenticateAdmin(body.secret ?? "");
    if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

    await createSession(adminStub, "admin");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 503 });
    }
    console.error("[admin/enter] authentication failed", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
