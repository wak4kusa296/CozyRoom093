/**
 * 秘密の言葉の再発行メール（件名・本文）
 * secretPhrase は台帳で選んだ guest の phrase（呼び名ヒントとは無関係）。
 */
export type RecoveryEmailDraftParams = {
  contactEmail: string;
  secretPhrase: string;
};

export function buildRecoveryReissueEmailDraft(
  params: RecoveryEmailDraftParams,
  options?: { delivery?: "clipboard" | "smtp" }
): {
  subject: string;
  body: string;
  clipboardText: string;
} {
  const delivery = options?.delivery ?? "smtp";
  const contactEmail = params.contactEmail.trim() || "（未入力）";
  const phrase = params.secretPhrase.trim();

  const subject = "【誰も知らない部屋】秘密の言葉のお知らせ";

  const footer =
    delivery === "smtp"
      ? ["────────", "※ このメールは、誰も知らない部屋の管理画面からお送りしています。"]
      : [
          "────────",
          `※ 送信先メールアドレス：${contactEmail}`,
          "※ 本テキストは管理画面のテンプレートです。"
        ];

  const body = [
    "お問い合わせ、ありがとうございました。",
    "",
    "秘密の言葉は、次のとおりです。",
    "",
    "━━━━━━━━",
    phrase,
    "━━━━━━━━",
    "",
    "またのお越しをお待ちしております。",
    "",
    ...footer
  ].join("\n");

  const clipboardText = `件名: ${subject}\n\n${body}`;

  return { subject, body, clipboardText };
}
