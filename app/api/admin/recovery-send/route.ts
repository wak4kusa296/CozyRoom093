import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildRecoveryReissueEmailDraft } from "@/lib/recovery-email-template";
import { sendTransactionalEmail, isSmtpConfigured } from "@/lib/mail";
import { updateGuestPhrase } from "@/lib/guest-credentials";
import { getRecoveryRequestById, markRecoveryRequestRead } from "@/lib/recovery-requests";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";
import { isValidSecretPhrase, secretPhraseContainsWhitespace } from "@/lib/passphrase-rules";
import { getRequestClientIp, rateLimitHeaders, takeRateLimit } from "@/lib/rate-limit";

function isValidEmail(value: string) {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const limit = takeRateLimit(`admin-recovery-send:${getRequestClientIp(request)}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) }
    );
  }

  if (!isSmtpConfigured()) {
    return NextResponse.json({ ok: false, error: "smtp_not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as { id?: string; guestId?: string; phrase?: string };
  const id = String(body.id ?? "").trim();
  const guestId = String(body.guestId ?? "").trim();
  const secretPhrase = String(body.phrase ?? "");
  if (!id || !guestId || !secretPhrase) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (secretPhraseContainsWhitespace(secretPhrase) || !isValidSecretPhrase(secretPhrase)) {
    return NextResponse.json({ ok: false, error: "invalid_phrase" }, { status: 400 });
  }

  const row = await getRecoveryRequestById(id);
  /** 無視済み（read_at あり）でも履歴から再発行できるようにする */
  if (!row) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!isValidEmail(row.contactEmail)) {
    return NextResponse.json({ ok: false, error: "invalid_contact_email" }, { status: 400 });
  }

  const { subject, body: text } = buildRecoveryReissueEmailDraft(
    { contactEmail: row.contactEmail, secretPhrase },
    { delivery: "smtp" }
  );

  try {
    const updated = await updateGuestPhrase(guestId, secretPhrase);
    if (!updated) return NextResponse.json({ ok: false, error: "invalid_guest" }, { status: 400 });
  } catch (error) {
    console.error("[recovery-send] credential update", error);
    return NextResponse.json({ ok: false, error: "invalid_guest" }, { status: 400 });
  }

  try {
    await sendTransactionalEmail({
      to: row.contactEmail.trim(),
      subject,
      text
    });
  } catch (e) {
    console.error("[recovery-send]", e);
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
  }

  await markRecoveryRequestRead(id);
  pingAdminNotificationSubscribers();
  return NextResponse.json({ ok: true });
}
