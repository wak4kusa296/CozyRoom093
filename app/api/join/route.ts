import { NextResponse } from "next/server";
import { buildGuestIdFromNow, insertGuestCredential } from "@/lib/guest-credentials";
import { isSmtpConfigured, sendTransactionalEmail } from "@/lib/mail";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";
import {
  HANDWRITTEN_PASSWORD_INVALID_MESSAGE,
  isValidHandwrittenPassword,
  isValidSecretPhrase,
  SECRET_PHRASE_WHITESPACE_MESSAGE,
  secretPhraseContainsWhitespace
} from "@/lib/passphrase-rules";
import { findActiveRegistrationGateByPhrase } from "@/lib/registration-gates";
import { buildSignupMemoEmailDraft, PHRASE_TAKEN_MESSAGE } from "@/lib/signup-email-template";
import { appendSignupNotification } from "@/lib/signup-notifications";
import { sendWebPushToAdminSubscribers } from "@/lib/web-push-deliver";
import { getRequestClientIp, rateLimitHeaders, takeRateLimit } from "@/lib/rate-limit";
import { toPublicAbsoluteHref } from "@/lib/public-url";

function isValidEmail(value: string) {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function loginUrlFromRequest(request: Request) {
  const configured = toPublicAbsoluteHref("/");
  if (configured.startsWith("http://") || configured.startsWith("https://")) return configured;
  try {
    return new URL("/", request.url).href;
  } catch {
    return "https://example.invalid/";
  }
}

export async function POST(request: Request) {
  const limit = takeRateLimit(`join:${getRequestClientIp(request)}`, 8, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit.retryAfterSeconds) });
  }

  const body = (await request.json()) as {
    gatePhrase?: string;
    guestName?: string;
    memo?: string;
    contactEmail?: string;
    phrase?: string;
  };

  const gatePhrase = String(body.gatePhrase ?? "").trim();
  const guestName = String(body.guestName ?? "").trim();
  const memo = String(body.memo ?? "").trim();
  const contactEmail = String(body.contactEmail ?? "").trim();
  const phrase = String(body.phrase ?? "");

  if (!gatePhrase || !guestName || !memo || !phrase) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  if (!isValidHandwrittenPassword(gatePhrase)) {
    return NextResponse.json(
      { ok: false, error: "invalid_gate_format", message: HANDWRITTEN_PASSWORD_INVALID_MESSAGE },
      { status: 400 }
    );
  }

  if (secretPhraseContainsWhitespace(phrase) || !isValidSecretPhrase(phrase)) {
    return NextResponse.json(
      { ok: false, error: "invalid_phrase_whitespace", message: SECRET_PHRASE_WHITESPACE_MESSAGE },
      { status: 400 }
    );
  }

  if (!isValidEmail(contactEmail)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const gate = await findActiveRegistrationGateByPhrase(gatePhrase);
  if (!gate) {
    return NextResponse.json({ ok: false, error: "invalid_gate" }, { status: 403 });
  }

  let guestId = buildGuestIdFromNow();
  let insertResult = await insertGuestCredential({ guestId, guestName, phrase, adminMemo: memo });
  if (insertResult === "id_taken") {
    await new Promise((r) => setTimeout(r, 1100));
    guestId = buildGuestIdFromNow();
    insertResult = await insertGuestCredential({ guestId, guestName, phrase, adminMemo: memo });
  }

  if (insertResult === "phrase_taken") {
    return NextResponse.json(
      { ok: false, error: "phrase_taken", message: PHRASE_TAKEN_MESSAGE },
      { status: 409 }
    );
  }
  if (insertResult !== "ok") {
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }

  let emailSent = false;
  if (isSmtpConfigured()) {
    try {
      const draft = buildSignupMemoEmailDraft({
        guestName,
        secretPhrase: phrase,
        loginUrl: loginUrlFromRequest(request)
      });
      await sendTransactionalEmail({
        to: contactEmail,
        subject: draft.subject,
        text: draft.body
      });
      emailSent = true;
    } catch (e) {
      console.error("[join] signup memo email", e);
    }
  }

  // contactEmail はここまで。DB・通知には保存しない。
  await appendSignupNotification({
    guestId,
    guestName,
    memo,
    emailSent
  });
  pingAdminNotificationSubscribers();

  try {
    await sendWebPushToAdminSubscribers({
      title: "新規登録",
      body: `${guestName} さんが登録しました。`,
      url: "/admin?notify=1"
    });
  } catch (e) {
    console.error("[join] web push to admins", e);
  }

  return NextResponse.json({
    ok: true,
    guestName,
    phrase,
    emailSent,
    loginPath: "/"
  });
}
