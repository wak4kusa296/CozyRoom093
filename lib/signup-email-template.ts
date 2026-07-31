/**
 * 新規登録完了の控えメール（件名・本文）
 * contactEmail は本文に書かず、送信先としてのみ使う（DB にも残さない）。
 */
import { PHRASE_ENTER_AS_SHOWN_HINT } from "@/lib/passphrase-rules";

export type SignupMemoEmailParams = {
  guestName: string;
  secretPhrase: string;
  loginUrl: string;
};

export { PHRASE_ENTER_AS_SHOWN_HINT } from "@/lib/passphrase-rules";
export {
  HANDWRITTEN_PASSWORD_INVALID_MESSAGE,
  HANDWRITTEN_PASSWORD_PAPER_HINT,
  HANDWRITTEN_PASSWORD_RULE_HINT,
  SECRET_PHRASE_RULE_HINT,
  isValidHandwrittenPassword
} from "@/lib/passphrase-rules";

export function buildSignupMemoEmailDraft(params: SignupMemoEmailParams): {
  subject: string;
  body: string;
} {
  const name = params.guestName.trim() || "ゲスト";
  const phrase = params.secretPhrase.trim();
  const loginUrl = params.loginUrl.trim();

  const subject = "【誰も知らない部屋】秘密の言葉の控え";

  const body = [
    `${name} さん`,
    "",
    "新規登録が完了しました。忘れないよう、このメールを控えておいてください。",
    "",
    "入室用のページ：",
    loginUrl,
    "",
    "秘密の言葉：",
    "━━━━━━━━",
    phrase,
    "━━━━━━━━",
    "",
    PHRASE_ENTER_AS_SHOWN_HINT,
    "",
    "またのお越しをお待ちしております。",
    "",
    "────────",
    "※ このメールは登録時の控えです。返信の必要はありません。"
  ].join("\n");

  return { subject, body };
}

export const PHRASE_TAKEN_MESSAGE = "この秘密の言葉はすでに使われています。別の言葉を選んでください。";
