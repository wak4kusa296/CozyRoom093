import { NextResponse } from "next/server";
import { appendRecoveryRequest } from "@/lib/recovery-requests";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";
import { sendWebPushToAdminSubscribers } from "@/lib/web-push-deliver";
import { getRequestClientIp, rateLimitHeaders, takeRateLimit } from "@/lib/rate-limit";

function isValidEmail(value: string) {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request: Request) {
  const limit = takeRateLimit(`recovery:${getRequestClientIp(request)}`, 5, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) });
  }

  const body = (await request.json()) as { hintName?: string; hintPlace?: string; contactEmail?: string };

  if (!body.hintName?.trim() || !body.hintPlace?.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!body.contactEmail?.trim() || !isValidEmail(body.contactEmail)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await appendRecoveryRequest(body.hintName, body.hintPlace, body.contactEmail);
  pingAdminNotificationSubscribers();

  try {
    await sendWebPushToAdminSubscribers({
      title: "秘密の言葉の問い合わせ",
      body: "新しい問い合わせが届きました。",
      url: "/admin?notify=1"
    });
  } catch (e) {
    console.error("[forget] web push to admins", e);
  }

  return NextResponse.json({ ok: true });
}
