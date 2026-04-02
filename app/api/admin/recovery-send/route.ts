import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildRecoveryReissueEmailDraft } from "@/lib/recovery-email-template";
import { sendTransactionalEmail, isSmtpConfigured } from "@/lib/mail";
import { getPassphraseByGuestId } from "@/lib/guest-credentials";
import { getRecoveryRequestById, markRecoveryRequestRead } from "@/lib/recovery-requests";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";

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

  if (!isSmtpConfigured()) {
    return NextResponse.json({ ok: false, error: "smtp_not_configured" }, { status: 503 });
  }

  const body = (await request.json()) as { id?: string; guestId?: string };
  const id = String(body.id ?? "").trim();
  const guestId = String(body.guestId ?? "").trim();
  if (!id || !guestId) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const row = await getRecoveryRequestById(id);
  if (!row || row.readAt) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!isValidEmail(row.contactEmail)) {
    return NextResponse.json({ ok: false, error: "invalid_contact_email" }, { status: 400 });
  }

  const secretPhrase = await getPassphraseByGuestId(guestId);
  if (!secretPhrase) {
    return NextResponse.json({ ok: false, error: "invalid_guest" }, { status: 400 });
  }

  const { subject, body: text } = buildRecoveryReissueEmailDraft(
    { contactEmail: row.contactEmail, secretPhrase },
    { delivery: "smtp" }
  );

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
