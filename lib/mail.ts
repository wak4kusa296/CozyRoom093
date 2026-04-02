import nodemailer from "nodemailer";

function parsePort(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isRelayNoAuth(): boolean {
  const v = process.env.SMTP_RELAY_NO_AUTH?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * 最低限: SMTP_HOST + SMTP_FROM
 * - 通常: SMTP_USER + SMTP_PASS（Google Workspace で「SMTP 認証を必須」にしている場合など）
 * - Google SMTP リレーで「送信元 IP のみ」許可のとき: SMTP_RELAY_NO_AUTH=1（ユーザー／パス不要）
 */
export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return false;
  if (isRelayNoAuth()) return true;
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

export async function sendTransactionalEmail(opts: { to: string; subject: string; text: string }) {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const host = process.env.SMTP_HOST!.trim();
  const port = parsePort(process.env.SMTP_PORT, 587);
  const secure =
    process.env.SMTP_SECURE === "1" ||
    process.env.SMTP_SECURE === "true" ||
    port === 465;

  const relayNoAuth = isRelayNoAuth();

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(relayNoAuth
      ? { auth: false as const }
      : {
          auth: {
            user: process.env.SMTP_USER!.trim(),
            pass: process.env.SMTP_PASS!.trim()
          }
        }),
    ...(port === 587 && !secure ? { requireTLS: true } : {})
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM!.trim(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text
  });
}
