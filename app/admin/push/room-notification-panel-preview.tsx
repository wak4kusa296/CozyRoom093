"use client";

/**
 * ルームの `RoomNotificationBell` が描画する通知パネルと同一構造（プレビュー用・操作不可）
 */
const ROOM_PANEL_DESC_UNREAD =
  "新着手記のお知らせと、管理者からの文通です。返信のお知らせは、該当の記事で文通を開くと既読になります。";

export type RoomNotificationPanelPreviewProps = {
  title: string;
  lead?: string;
  whenLabel: string;
};

export function RoomNotificationPanelPreview({
  title,
  lead,
  whenLabel
}: RoomNotificationPanelPreviewProps) {
  return (
    <div
      className="admin-notification-panel admin-notification-panel--portal room-push-panel-preview"
      role="region"
      aria-label="ルーム通知パネルの見え方"
    >
      <header className="admin-notification-panel-head">
        <div className="room-notification-panel-head-row">
          <h2 className="admin-notification-panel-title">通知センター</h2>
          <button
            type="button"
            className="room-notification-filter-toggle"
            tabIndex={-1}
            aria-hidden="true"
            disabled
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              filter_list
            </span>
          </button>
        </div>
        <p className="admin-notification-panel-desc">{ROOM_PANEL_DESC_UNREAD}</p>
      </header>
      <ul className="admin-notification-list">
        <li className="is-unread room-notification-reply-card room-notification-push-item">
          <button type="button" className="room-notification-push-card-main" tabIndex={-1} disabled>
            <span className="room-notification-push-kind">プッシュ通知</span>
            <p className="admin-notification-when">{whenLabel}</p>
            <span className="room-notification-push-title">{title}</span>
            {lead ? <span className="room-notification-push-subtitle">{lead}</span> : null}
          </button>
        </li>
      </ul>
    </div>
  );
}
