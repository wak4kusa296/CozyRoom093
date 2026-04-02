export type RoomNotificationContentItem = {
  kind: "content";
  id: string;
  slug: string;
  title: string;
  createdAt: string;
  /** 履歴表示時: 既読にした日時 */
  readAt?: string;
};

export type RoomNotificationReplyItem = {
  kind: "reply";
  id: string;
  /** スレッドファイル名用の正規化キー */
  slugKey: string;
  /** `/room/[slug]` に使う実スラッグ（記事 MD のファイル名） */
  slug: string;
  body: string;
  createdAt: string;
  /** 履歴表示時: 既読にした日時 */
  readAt?: string;
};

/** 管理画面から送信したブロードキャストプッシュ（`push|` + UUID） */
export type RoomNotificationPushItem = {
  kind: "push";
  id: string;
  title: string;
  body: string;
  /** 送信日時 */
  createdAt: string;
  /** 履歴表示時: 既読にした日時 */
  readAt?: string;
  /** リード文（一覧・モーダル・通知2行目）。旧 API 互換で subtitle も参照 */
  lead?: string;
  subtitle?: string;
  linkUrl?: string;
  linkLabel?: string;
  imageUrl?: string;
};

export type RoomNotificationItem =
  | RoomNotificationContentItem
  | RoomNotificationReplyItem
  | RoomNotificationPushItem;

export type RoomNotificationView = "unread" | "history";
