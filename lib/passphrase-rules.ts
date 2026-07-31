/** 手書きのパスワード: 半角の英数字・記号のみ（空白なしの印字可能 ASCII） */
const HANDWRITTEN_PASSWORD_PATTERN = /^[\x21-\x7E]+$/;

export function isValidHandwrittenPassword(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && HANDWRITTEN_PASSWORD_PATTERN.test(v);
}

export const HANDWRITTEN_PASSWORD_RULE_HINT =
  "半角の英数字・記号のみ使えます（日本語や全角文字は使えません）。";

/** 紙に書く手書きパスワード向け（管理人向け案内） */
export const HANDWRITTEN_PASSWORD_PAPER_HINT =
  "半角の英数字・記号のみです。紙に書くときは、O と 0、I と 1、l と 1 など読み違えやすい文字を避けると安心です。";

/** 入力確定後の自動判別で弾くときの表示（登録画面） */
export const HANDWRITTEN_PASSWORD_INVALID_MESSAGE =
  "半角の英数字・記号のみ使えます（日本語や全角文字は使えません）。紙に書かれた文字を見たまま入力してください。";

/** 秘密の言葉に空白（半角・全角スペース、前後含む）があるか */
export function secretPhraseContainsWhitespace(value: string): boolean {
  return /\s/u.test(value);
}

/** 空でなく、どこにも空白がない */
export function isValidSecretPhrase(value: string): boolean {
  return value.length > 0 && !secretPhraseContainsWhitespace(value);
}

export const SECRET_PHRASE_WHITESPACE_MESSAGE = "秘密の言葉に空白（スペース）は使えません。";

/** 入室時は表示どおり（秘密の言葉向け） */
export const PHRASE_ENTER_AS_SHOWN_HINT =
  "入室するときは、表示された文字をそのまま入力してください（全角・半角の違いも別の言葉になります）。";

export const SECRET_PHRASE_RULE_HINT =
  "日本語でも構いません。空白は使えません。あとで入室するときは、決めた文字をそのまま入力してください。（全角・半角の違いも別の言葉になります）";
