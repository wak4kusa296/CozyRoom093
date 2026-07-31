import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

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

const SENDER_NAME = "誰も知らない部屋";

/** "Name <a@b.c>" でも "a@b.c" でも、アドレス部分だけ取り出す */
function extractAddress(value: string): string {
  const m = value.match(/<([^>]+)>/);
  return (m ? m[1] : value).trim();
}

function addressDomain(value: string): string {
  const at = extractAddress(value).lastIndexOf("@");
  return at === -1 ? "" : extractAddress(value).slice(at + 1);
}

/** 差出人名がなければ付ける（名前なしの生アドレスは迷惑メール判定されやすい） */
function buildFromHeader(rawFrom: string): string {
  if (rawFrom.includes("<")) return rawFrom;
  return `"${SENDER_NAME}" <${rawFrom}>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 本文中の URL だけリンクにした、素朴な HTML 版を作る */
function textToHtml(text: string): string {
  const body = escapeHtml(text).replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}">${url}</a>`
  );
  return [
    '<!doctype html><html lang="ja"><body>',
    '<div style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#222;white-space:pre-wrap;">',
    body,
    "</div></body></html>"
  ].join("");
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
  const rawFrom = process.env.SMTP_FROM!.trim();
  const fromAddress = extractAddress(rawFrom);
  const fromDomain = addressDomain(rawFrom);

  const transportOptions: SMTPTransport.Options = {
    host,
    port,
    secure,
    ...(relayNoAuth
      ? {}
      : {
          auth: {
            user: process.env.SMTP_USER!.trim(),
            pass: process.env.SMTP_PASS!.trim()
          }
        }),
    ...(port === 587 && !secure ? { requireTLS: true } : {})
  };
  const transporter = nodemailer.createTransport(transportOptions);

  await transporter.sendMail({
    from: buildFromHeader(rawFrom),
    sender: fromAddress,
    replyTo: process.env.SMTP_REPLY_TO?.trim() || fromAddress,
    /* Return-Path を From と揃えて SPF を通す */
    envelope: { from: fromAddress, to: extractAddress(opts.to) },
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: textToHtml(opts.text),
    /* Message-ID は既定だと送信ホスト名になる。From ドメインに揃えると DMARC 評価で有利。 */
    ...(fromDomain ? { messageId: `<${randomUUID()}@${fromDomain}>` } : {}),
    headers: {
      /* 自動送信の控えであることを明示（一斉配信と区別されやすくなる） */
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All"
    }
  });
}
