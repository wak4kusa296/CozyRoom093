/** クライアント／サーバー共有の文通ヘルパー（DB 非依存） */

export type SenderRole = "admin" | "guest";

export type Letter = {
  id: number;
  sender: string;
  senderRole: SenderRole;
  body: string;
  createdAt: string;
};

/** 新規投函の入力（id は DB 側で採番されるため含まない） */
export type NewLetterInput = {
  sender: string;
  senderRole: SenderRole;
  body: string;
  createdAt: string;
};

/** 記事に紐づかないお手紙用の旧予約スラッグ（互換用） */
export const FAN_LETTER_SLUG = "__fan";

export const FAN_LETTER_TITLE = "お手紙";

export const LETTER_TITLE_MAX_LENGTH = 40;

export const LETTER_BODY_MAX_LENGTH = 4000;

/** 文通で表示する管理者名。役割判定には使わない。 */
export const ADMIN_DISPLAY_NAME = "管理人";

export function normalizeThreadKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/** レガシー互換: 記事に紐づかないお手紙の旧予約スラッグ判定。新規導線では発生しない（削除予定）。 */
export function isFanLetterSlug(slug: string): boolean {
  return normalizeThreadKey(slug) === normalizeThreadKey(FAN_LETTER_SLUG);
}

/**
 * 記事以外のお手紙スレッド判定。新規導線は `__note-*` のみを生成する。
 * `__fan` 分岐はレガシー互換（旧仕様の唯一のお手紙スレッド）で、新規導線では発生しない（削除予定）。
 */
export function isStandaloneLetterSlug(slug: string): boolean {
  const key = normalizeThreadKey(slug);
  return key === normalizeThreadKey(FAN_LETTER_SLUG) || key.startsWith("__note-");
}

export function normalizeLetterTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function letterThreadDisplayTitle(
  slugKey: string,
  contentTitle?: string | null,
  customTitle?: string | null
): string {
  const custom = customTitle?.trim();
  if (custom) return custom;
  if (isStandaloneLetterSlug(slugKey)) return FAN_LETTER_TITLE;
  return contentTitle?.trim() || slugKey;
}

/** ゲスト向け：該当スレッドを開く URL */
export function guestLetterOpenUrl(slug: string): string {
  if (isStandaloneLetterSlug(slug)) {
    return `/room/letters?thread=${encodeURIComponent(slug)}`;
  }
  // レガシー互換: ?letters=open は旧 __fan 導線向け。新規導線では発生しない（削除予定）。
  return `/room/${encodeURIComponent(slug)}?letters=open`;
}

export type LetterThreadSummary = {
  slugKey: string;
  guestKey: string;
  count: number;
  latestAt: string | null;
  latestSender: string | null;
  latestSenderRole: SenderRole | null;
  latestBody: string | null;
  title?: string | null;
};

export function guestLetterEventId(letterId: number): string {
  return `letter|${letterId}`;
}

export function adminLetterNotificationId(letterId: number): string {
  return `adminLetter|${letterId}`;
}

/** Web Push 本文は定型文のみとし、投稿内容のプレビューは含めない */
export const LETTER_REPLY_PUSH_BODY = "文通に返信がありました。";

export function letterNewThreadPushBody(title: string): string {
  const trimmed = title.trim();
  return trimmed ? `「${trimmed}」という新しいお手紙が届いています。` : "新しいお手紙が届いています。";
}
