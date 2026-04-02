"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RecoveryGuestPicker, type RecoveryGuestOption } from "./recovery-guest-picker";
import { shouldShowPermitPushButton } from "@/lib/push-permit-ui";
import { subscribeRoomPush } from "@/lib/room-push-subscribe-client";
import { formatSiteDateTime, formatSiteDateTimeWithSeconds } from "@/lib/site-datetime";

type RecoveryFeedItem = {
  kind: "recovery";
  id: string;
  hintName: string;
  hintPlace: string;
  contactEmail: string;
  createdAt: string;
  readAt: string | null;
};

type LetterFeedItem = {
  kind: "letter";
  id: string;
  slugKey: string;
  guestKey: string;
  sender: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

type FeedItem = RecoveryFeedItem | LetterFeedItem;

function truncateBody(text: string, max = 120) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [gate, setGate] = useState<"loading" | "guest" | "admin">("loading");
  const [mounted, setMounted] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 56, right: 16 });
  const [sendingRecoveryId, setSendingRecoveryId] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [recoveryGuestOptions, setRecoveryGuestOptions] = useState<RecoveryGuestOption[]>([]);
  /** 複数ゲスト時のみ。再発行1件ごとに、台帳のどのユーザー宛か */
  const [recoveryGuestPick, setRecoveryGuestPick] = useState<Record<string, string>>({});
  const [pushPermitVisible, setPushPermitVisible] = useState(false);
  const [pushPermitBusy, setPushPermitBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshPushPermitVisibility();
    };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshPushPermitVisibility]);

  const onPermitPush = useCallback(async () => {
    setPushPermitBusy(true);
    try {
      const result = await subscribeRoomPush();
      if (result === "granted") setPushPermitVisible(false);
    } finally {
      setPushPermitBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/notifications", { cache: "no-store" });
    if (res.status === 403) {
      setGate("guest");
      return;
    }
    if (!res.ok) return;
    setGate("admin");
    const data = (await res.json()) as {
      items?: FeedItem[];
      unreadCount?: number;
      smtpConfigured?: boolean;
      recoveryGuestOptions?: RecoveryGuestOption[];
    };
    setItems(data.items ?? []);
    setUnreadCount(data.unreadCount ?? 0);
    setSmtpConfigured(Boolean(data.smtpConfigured));
    setRecoveryGuestOptions(Array.isArray(data.recoveryGuestOptions) ? data.recoveryGuestOptions : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => void load(), 45000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("admin-notifications-refresh", onRefresh);
    return () => window.removeEventListener("admin-notifications-refresh", onRefresh);
  }, [load]);

  useEffect(() => {
    if (gate !== "admin") return;
    const es = new EventSource("/api/admin/notifications/events");
    es.onmessage = () => void load();
    return () => es.close();
  }, [gate, load]);

  useLayoutEffect(() => {
    if (!open || !bellRef.current) return;
    const r = bellRef.current.getBoundingClientRect();
    setPanelPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      /** RecoveryGuestPicker のメニューは portal で body 直下のため、外側扱いにならないようにする */
      if (t.closest(".admin-notification-guest-menu")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string) {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) void load();
      else void load();
    } catch {
      void load();
    }
  }

  function resolveRecoveryGuestId(rowId: string): string {
    if (recoveryGuestOptions.length === 1) return recoveryGuestOptions[0].guestId;
    return (recoveryGuestPick[rowId] ?? "").trim();
  }

  async function sendRecoveryEmail(row: RecoveryFeedItem) {
    if (!row.contactEmail.trim()) {
      window.alert("宛先メールアドレスがありません。");
      return;
    }
    if (recoveryGuestOptions.length === 0) {
      window.alert("台帳にゲストがいません。管理画面のユーザー一覧を確認してください。");
      return;
    }
    const guestId = resolveRecoveryGuestId(row.id);
    if (!guestId) {
      window.alert("再発行メールを送る相手を、台帳から選んでください。");
      return;
    }
    setSendingRecoveryId(row.id);
    try {
      const res = await fetch("/api/admin/recovery-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, guestId })
      });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== row.id));
        setUnreadCount((c) => Math.max(0, c - 1));
        void load();
        return;
      }
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 503) {
        window.alert("SMTP が未設定です。.env に SMTP_HOST などを設定し、サーバーを再起動してください。");
      } else if (res.status === 400 && err.error === "invalid_guest") {
        window.alert("選択したユーザーが台帳に見つかりません。一覧を更新してから再度お試しください。");
      } else if (res.status === 400 && err.error === "invalid_contact_email") {
        window.alert("宛先メールアドレスが無効です。データベース上の連絡先を修正してください。");
      } else if (res.status === 502) {
        window.alert("メールの送信に失敗しました。SMTP 設定とログを確認してください。");
      } else {
        window.alert("送信できませんでした。");
      }
      void load();
    } catch {
      window.alert("送信できませんでした。");
      void load();
    } finally {
      setSendingRecoveryId(null);
    }
  }

  if (gate !== "admin") return null;

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
        aria-labelledby="admin-notification-title"
        style={{ top: panelPos.top, right: panelPos.right }}
      >
        <header className="admin-notification-panel-head">
          <div className="room-notification-panel-head-row">
            <h2 id="admin-notification-title" className="admin-notification-panel-title">
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
            </div>
          </div>
          <p className="admin-notification-panel-desc">
            再発行の問い合わせと、ゲストからの文通です。再発行はメール送信または「無視」で一覧から消えます。文通はスレッドを開くか「対応済み」で消えます。
          </p>
          {!smtpConfigured ? (
            <p className="admin-notification-smtp-hint" role="status">
              <span className="material-symbols-outlined admin-notification-smtp-icon" aria-hidden="true">
                outgoing_mail
              </span>
              <span>
                SMTP が未設定のため、再発行メールの送信ができません。.env に SMTP_HOST などを設定し、サーバーを再起動してください。
              </span>
            </p>
          ) : null}
        </header>
        {items.length === 0 ? (
          <p className="meta admin-notification-empty">通知はありません。</p>
        ) : (
          <ul className="admin-notification-list">
            {items.map((row) =>
              row.kind === "recovery" ? (
                <li key={row.id} className="room-notification-reply-card room-notification-admin-recovery is-unread">
                  <span className="room-notification-push-kind">秘密の言葉の問い合わせ</span>
                  <p className="admin-notification-when">{formatSiteDateTimeWithSeconds(row.createdAt)}</p>
                  <p className="room-notification-reply-lead">
                    <span className="admin-notification-label">呼び名</span> {row.hintName}
                  </p>
                  <p className="admin-notification-letter-preview">
                    <span className="admin-notification-label">場面</span> {row.hintPlace}
                  </p>
                  <p className="admin-notification-letter-preview">
                    <span className="admin-notification-label">宛先メール</span> {row.contactEmail || "（未入力）"}
                  </p>
                  <div
                    className={
                      smtpConfigured && recoveryGuestOptions.length > 1
                        ? "admin-notification-item-actions admin-notification-item-actions--stack"
                        : "admin-notification-item-actions"
                    }
                  >
                    {smtpConfigured && recoveryGuestOptions.length > 1 ? (
                      <RecoveryGuestPicker
                        rowId={row.id}
                        options={recoveryGuestOptions}
                        value={recoveryGuestPick[row.id] ?? ""}
                        onChange={(guestId) =>
                          setRecoveryGuestPick((prev) => ({ ...prev, [row.id]: guestId }))
                        }
                      />
                    ) : null}
                    {smtpConfigured ? (
                      <button
                        type="button"
                        className="room-notification-seal-button admin-notification-primary-action"
                        disabled={
                          sendingRecoveryId === row.id ||
                          !row.contactEmail.trim() ||
                          recoveryGuestOptions.length === 0 ||
                          (recoveryGuestOptions.length > 1 && !resolveRecoveryGuestId(row.id))
                        }
                        onClick={() => void sendRecoveryEmail(row)}
                      >
                        {sendingRecoveryId === row.id ? "送信中…" : "再発行メールを送る"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="admin-small-button"
                      disabled={sendingRecoveryId === row.id}
                      onClick={() => void markRead(row.id)}
                    >
                      無視
                    </button>
                  </div>
                </li>
              ) : (
                <li key={row.id} className="room-notification-reply-card is-unread">
                  <span className="room-notification-push-kind">文通</span>
                  <p className="admin-notification-when">{formatSiteDateTimeWithSeconds(row.createdAt)}</p>
                  <p className="room-notification-reply-lead">{row.sender}さんからの便り</p>
                  <p className="admin-notification-letter-preview">{truncateBody(row.body)}</p>
                  <p>
                    <a
                      href={`/admin/letters?slug=${encodeURIComponent(row.slugKey)}&guest=${encodeURIComponent(row.guestKey)}`}
                      className="room-notification-seal-button"
                      onClick={() => setOpen(false)}
                    >
                      スレッドを開く
                    </a>
                  </p>
                  <div className="admin-notification-item-actions">
                    <button type="button" className="admin-small-button" onClick={() => void markRead(row.id)}>
                      対応済み
                    </button>
                  </div>
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
          void load();
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          notifications
        </span>
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
