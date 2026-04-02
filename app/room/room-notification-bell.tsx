"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArticleStylePushLink } from "@/app/components/article-style-push-link";
import type { RoomNotificationItem, RoomNotificationView } from "@/lib/room-notifications";
import { shouldShowPermitPushButton } from "@/lib/push-permit-ui";
import { subscribeRoomPush } from "@/lib/room-push-subscribe-client";
import { formatSiteDateTime, formatSiteDateTimeWithSeconds } from "@/lib/site-datetime";

export function RoomNotificationBell() {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<RoomNotificationView>("unread");
  const [items, setItems] = useState<RoomNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  /** /room にいる時点でログイン前提。401 のときだけ非表示 */
  const [sessionActive, setSessionActive] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 56, right: 16 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const pushDialogRef = useRef<HTMLDialogElement | null>(null);
  const [pushPermitVisible, setPushPermitVisible] = useState(false);
  const [pushPermitBusy, setPushPermitBusy] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const nonSilentLoadCountRef = useRef(0);
  const loadEffectFirstRun = useRef(true);

  const [pushModal, setPushModal] = useState<{
    title: string;
    body: string;
    sentAt: string;
    lead?: string;
    linkUrl?: string;
    linkLabel?: string;
    imageUrl?: string;
    /** 未読一覧から開いたとき、モーダル表示と同タイミングで既読にする */
    pendingMarkReadId?: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshPushPermitVisibility = useCallback(async () => {
    setPushPermitVisible(await shouldShowPermitPushButton());
  }, []);

  useEffect(() => {
    void refreshPushPermitVisibility();
  }, [refreshPushPermitVisibility]);

  useEffect(() => {
    if (open) void refreshPushPermitVisibility();
  }, [open, refreshPushPermitVisibility]);

  const onPermitPush = useCallback(async () => {
    setPushPermitBusy(true);
    try {
      const result = await subscribeRoomPush();
      if (result === "granted") setPushPermitVisible(false);
    } finally {
      setPushPermitBusy(false);
    }
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      nonSilentLoadCountRef.current += 1;
      setListLoading(true);
    }
    try {
      const res = await fetch(`/api/room/notifications?view=${viewMode}`, { cache: "no-store" });
      if (res.status === 401) {
        setSessionActive(false);
        return;
      }
      if (!res.ok) return;
      setSessionActive(true);
      const data = (await res.json()) as {
        items?: RoomNotificationItem[];
        unreadCount?: number;
      };
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      if (!silent) {
        nonSilentLoadCountRef.current -= 1;
        if (nonSilentLoadCountRef.current <= 0) {
          nonSilentLoadCountRef.current = 0;
          setListLoading(false);
        }
      }
    }
  }, [viewMode]);

  useEffect(() => {
    const silent = loadEffectFirstRun.current;
    loadEffectFirstRun.current = false;
    void load({ silent });
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load({ silent: true }), 45000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!sessionActive) return;
    const es = new EventSource("/api/room/notifications/events");
    es.onmessage = () => void load({ silent: true });
    return () => es.close();
  }, [sessionActive, load]);

  useEffect(() => {
    const onRefresh = () => void load({ silent: true });
    window.addEventListener("room-notifications-refresh", onRefresh);
    return () => window.removeEventListener("room-notifications-refresh", onRefresh);
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await fetch("/api/room/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) void load({ silent: true });
      else void load({ silent: true });
    } catch {
      void load({ silent: true });
    }
  }, [load]);

  useLayoutEffect(() => {
    if (!open || !bellRef.current) return;
    const r = bellRef.current.getBoundingClientRect();
    setPanelPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }, [open, viewMode]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        wrapRef.current?.contains(t) ||
        panelRef.current?.contains(t) ||
        pushDialogRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 640px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!pushModal) return;
    const el = pushDialogRef.current;
    if (!el) return;
    if (!el.open) {
      el.showModal();
    }
    const markId = pushModal.pendingMarkReadId;
    if (markId) {
      void markRead(markId);
      setPushModal((prev) => (prev ? { ...prev, pendingMarkReadId: undefined } : null));
    }
  }, [pushModal, markRead]);

  if (!sessionActive) return null;

  const panel = open ? (
    <>
      <div
        className="room-notification-panel-backdrop"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        className="admin-notification-panel admin-notification-panel--portal"
        role="dialog"
        aria-labelledby="room-notification-title"
        style={{ top: panelPos.top, right: panelPos.right }}
      >
        <header className="admin-notification-panel-head">
          <div className="room-notification-panel-head-row">
            <h2 id="room-notification-title" className="admin-notification-panel-title">
              通知センター
            </h2>
            <div className="room-notification-panel-actions">
              {pushPermitVisible ? (
                <button
                  type="button"
                  className="room-push-notify-banner-primary room-notification-permit-push-inline"
                  disabled={pushPermitBusy}
                  onClick={() => void onPermitPush()}
                >
                  通知を許可
                </button>
              ) : null}
              <button
                type="button"
                className={`room-notification-filter-toggle${viewMode === "history" ? " is-active" : ""}`}
                aria-label={viewMode === "unread" ? "過去の既読を表示" : "未読の通知に戻る"}
                aria-pressed={viewMode === "history"}
                title={viewMode === "unread" ? "過去の既読" : "未読に戻る"}
                onClick={() => {
                  setViewMode((v) => (v === "unread" ? "history" : "unread"));
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  filter_list
                </span>
              </button>
            </div>
        </div>
        <p className="admin-notification-panel-desc">
          {viewMode === "unread"
            ? "新着公開のお知らせと、管理者からの文通です。公開のお知らせは記事を開くと既読になり、返信のお知らせは該当記事で文通を開くと既読になります。手動プッシュは本文モーダルを開いたときに既読になります。"
            : "既読にした通知の履歴です。プッシュ通知のカードをタップすると本文を表示できます。フィルターをもう一度押すと未読一覧に戻ります。"}
        </p>
      </header>
      {listLoading ? (
        <div
          className="room-notification-list-loading"
          role="status"
          aria-live="polite"
          aria-label="通知を読み込み中"
        >
          <span className="room-notification-list-loading-dot" />
          <span className="room-notification-list-loading-dot" />
          <span className="room-notification-list-loading-dot" />
        </div>
      ) : items.length === 0 ? (
        <p className="meta admin-notification-empty">
          {viewMode === "history" ? "過去の通知はありません。" : "通知はありません。"}
        </p>
      ) : (
        <ul className="admin-notification-list">
          {items.map((row) =>
            row.kind === "push" ? (
              <li
                key={row.id}
                className={`room-notification-reply-card room-notification-push-item${
                  viewMode === "history" ? " is-history" : " is-unread"
                }`}
              >
                <button
                  type="button"
                  className="room-notification-push-card-main"
                  onClick={() => {
                    setPushModal({
                      title: row.title,
                      body: row.body,
                      sentAt: row.createdAt,
                      lead: row.lead ?? row.subtitle,
                      linkUrl: row.linkUrl,
                      linkLabel: row.linkLabel,
                      imageUrl: row.imageUrl,
                      pendingMarkReadId: viewMode === "unread" ? row.id : undefined
                    });
                  }}
                >
                  <span className="room-notification-push-kind">プッシュ通知</span>
                  <p className="admin-notification-when">{formatSiteDateTimeWithSeconds(row.createdAt)}</p>
                  <span className="room-notification-push-title">{row.title}</span>
                  {(row.lead ?? row.subtitle) ? (
                    <span className="room-notification-push-subtitle">{row.lead ?? row.subtitle}</span>
                  ) : null}
                </button>
              </li>
            ) : row.kind === "content" ? (
              <li
                key={row.id}
                className={`room-notification-reply-card room-notification-content-published${
                  viewMode === "history" ? " is-history" : " is-unread"
                }`}
              >
                <a
                  href={`/room/${encodeURIComponent(row.slug)}`}
                  className="room-notification-content-published-link"
                  onClick={() => setOpen(false)}
                >
                  <p className="admin-notification-when">{formatSiteDateTime(row.createdAt)}</p>
                  <p className="room-notification-reply-lead">{row.title}が公開されました。</p>
                </a>
              </li>
            ) : (
              <li
                key={row.id}
                className={`room-notification-reply-card${viewMode === "history" ? " is-history" : " is-unread"}`}
              >
                <p className="admin-notification-when">{formatSiteDateTime(row.createdAt)}</p>
                <p className="room-notification-reply-lead">管理人からお手紙が届いています。</p>
                <a
                  href={`/room/${encodeURIComponent(row.slug)}?letters=open`}
                  className="room-notification-seal-button"
                  onClick={() => setOpen(false)}
                >
                  封をあける
                </a>
              </li>
            )
          )}
        </ul>
      )}
      </div>
    </>
  ) : null;

  return (
    <div className="admin-notification-wrap" ref={wrapRef}>
      <button
        ref={bellRef}
        type="button"
        className={`admin-notification-bell${unreadCount > 0 ? " admin-notification-bell--unread" : ""}`}
        aria-label={
          unreadCount > 0
            ? `通知センターを開く（未読${unreadCount > 99 ? "が多数あり" : `${unreadCount}件`}）`
            : "通知センターを開く"
        }
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          void load({ silent: false });
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          notifications
        </span>
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
      {mounted && pushModal
        ? createPortal(
            <dialog
              ref={pushDialogRef}
              className="room-notification-push-dialog"
              aria-labelledby="room-push-dialog-title"
              onClose={() => setPushModal(null)}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  e.currentTarget.close();
                }
              }}
            >
              <div className="room-notification-push-dialog-inner">
                <div className="room-notification-push-dialog-header-row">
                  <h3 id="room-push-dialog-title" className="room-notification-push-dialog-title">
                    {pushModal.title}
                  </h3>
                  <button
                    type="button"
                    className="room-notification-push-dialog-close"
                    aria-label="閉じる"
                    onClick={() => pushDialogRef.current?.close()}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      close
                    </span>
                  </button>
                </div>
                {pushModal.lead ? (
                  <p className="room-notification-push-dialog-subtitle">{pushModal.lead}</p>
                ) : null}
                <p className="room-notification-push-dialog-meta">{formatSiteDateTimeWithSeconds(pushModal.sentAt)}</p>
                {pushModal.imageUrl ? (
                  <div className="room-notification-push-dialog-image-wrap">
                    <img
                      src={pushModal.imageUrl}
                      alt=""
                      className="room-notification-push-dialog-image"
                    />
                  </div>
                ) : null}
                <div className="room-notification-push-dialog-body">{pushModal.body}</div>
                {pushModal.linkUrl ? (
                  <ArticleStylePushLink href={pushModal.linkUrl}>
                    {pushModal.linkLabel ?? "開く"}
                  </ArticleStylePushLink>
                ) : null}
              </div>
            </dialog>,
            document.body
          )
        : null}
    </div>
  );
}
