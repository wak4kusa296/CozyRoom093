"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RecoveryGuestPicker, type RecoveryGuestOption } from "./recovery-guest-picker";
import { shouldShowPermitPushButton } from "@/lib/push-permit-ui";
import { subscribeRoomPush } from "@/lib/room-push-subscribe-client";
import { formatSiteDateTime, formatSiteDateTimeWithSeconds } from "@/lib/site-datetime";
import { useNotificationEventStream } from "@/lib/use-notification-event-stream";
import { useNotificationShell } from "@/lib/use-notification-shell";

type RecoveryFeedItem = {
  kind: "recovery";
  id: string;
  hintName: string;
  hintPlace: string;
  contactEmail: string;
  createdAt: string;
  readAt: string | null;
};

type SignupFeedItem = {
  kind: "signup";
  id: string;
  guestId: string;
  guestName: string;
  memo: string;
  emailSent: boolean;
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

type FeedItem = RecoveryFeedItem | SignupFeedItem | LetterFeedItem;

function truncateBody(text: string, max = 120) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function AdminNotificationBell() {
  const [viewMode, setViewMode] = useState<"unread" | "history">("unread");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [gate, setGate] = useState<"loading" | "guest" | "admin">("loading");
  const [sendingRecoveryId, setSendingRecoveryId] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [recoveryGuestOptions, setRecoveryGuestOptions] = useState<RecoveryGuestOption[]>([]);
  /** 複数ゲスト時のみ。再発行1件ごとに、台帳のどのユーザー宛か */
  const [recoveryGuestPick, setRecoveryGuestPick] = useState<Record<string, string>>({});
  const [pushPermitVisible, setPushPermitVisible] = useState(false);
  const [pushPermitBusy, setPushPermitBusy] = useState(false);
  const [pushPermitMessage, setPushPermitMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const isOutsideTargetIgnored = useCallback(
    (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(".admin-notification-guest-menu")),
    []
  );
  const { mounted, open, panelPos, setOpen } = useNotificationShell({
    bellRef,
    panelRef,
    isOutsideTargetIgnored
  });

  /** 通知タップで /admin?notify=1 に来たときは、お知らせを開いた状態で見せる */
  useEffect(() => {
    if (gate !== "admin") return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("notify") !== "1") return;
    setOpen(true);
    url.searchParams.delete("notify");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [gate, setOpen]);

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
      if (result === "granted") {
        setPushPermitMessage("通知を許可しました。");
      } else if (result === "denied") {
        setPushPermitMessage("通知は許可されませんでした。ブラウザのサイト設定から変更できます。");
      } else if (result === "error") {
        setPushPermitMessage("通知の設定を保存できませんでした。接続を確認して、もう一度お試しください。");
      } else {
        setPushPermitMessage("この端末では通知を設定できません。");
      }
    } finally {
      setPushPermitBusy(false);
      void refreshPushPermitVisibility();
    }
  }, [refreshPushPermitVisibility]);

  const load = useCallback(async () => {
    try {
      setNotificationError(null);
      const res = await fetch(`/api/admin/notifications?view=${viewMode}`, { cache: "no-store" });
      if (res.status === 403) {
        setGate("guest");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setNotificationError(data?.error?.message ?? "通知を読み込めませんでした。接続を確認して、もう一度お試しください。");
        return;
      }
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
    } catch {
      setNotificationError("通知を読み込めませんでした。接続を確認して、もう一度お試しください。");
    }
  }, [viewMode]);

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

  useNotificationEventStream({
    enabled: gate === "admin",
    url: "/api/admin/notifications/events",
    onEvent: () => void load(),
    onFallback: () => void load()
  });

  async function markRead(id: string) {
    if (viewMode === "unread") {
      setItems((prev) => prev.filter((x) => x.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    try {
      setNotificationError(null);
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setNotificationError(data?.error?.message ?? "通知を既読にできませんでした。もう一度お試しください。");
      }
      void load();
    } catch {
      setNotificationError("通知を既読にできませんでした。もう一度お試しください。");
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
    const phrase = window.prompt("新しい秘密の言葉を入力してください。メールで送信され、以前の言葉は使えなくなります。");
    if (!phrase?.trim()) return;
    setSendingRecoveryId(row.id);
    try {
      const res = await fetch("/api/admin/recovery-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, guestId, phrase })
      });
      if (res.ok) {
        if (viewMode === "unread") {
          setItems((prev) => prev.filter((x) => x.id !== row.id));
          setUnreadCount((c) => Math.max(0, c - 1));
        }
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
      } else if (res.status === 400 && err.error === "invalid_phrase") {
        window.alert("秘密の言葉の形式を確認してください。空白は使えません。");
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
        aria-modal="true"
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
              <button
                type="button"
                className={`room-notification-filter-toggle${viewMode === "history" ? " is-active" : ""}`}
                aria-label={viewMode === "unread" ? "過去の対応済みを表示" : "未読の通知に戻る"}
                aria-pressed={viewMode === "history"}
                title={viewMode === "unread" ? "過去の対応済み" : "未読に戻る"}
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
              ? "新規登録・再発行の問い合わせ・ゲストからの文通です。新規登録は「確認した」で消えます。再発行はメール送信または「無視」、文通はスレッドを開くか「対応済み」で消えます。"
              : "無視・確認済み・対応済みにした通知の履歴です。誤って無視した問い合わせもここから内容を確認し、再発行メールを送れます。フィルターをもう一度押すと未読一覧に戻ります。"}
          </p>
          {pushPermitMessage ? (
            <p className="admin-notification-panel-desc" role="status">
              {pushPermitMessage}
            </p>
          ) : null}
          {notificationError ? (
            <p className="letter-form-error" role="alert">
              {notificationError}
            </p>
          ) : null}
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
          <p className="meta admin-notification-empty">
            {viewMode === "history" ? "過去の通知はありません。" : "通知はありません。"}
          </p>
        ) : (
          <ul className="admin-notification-list">
            {items.map((row) =>
              row.kind === "recovery" ? (
                <li
                  key={row.id}
                  className={`room-notification-reply-card room-notification-admin-recovery${
                    viewMode === "history" ? " is-history" : " is-unread"
                  }`}
                >
                  <span className="room-notification-push-kind">秘密の言葉の問い合わせ</span>
                  <p className="admin-notification-when">{formatSiteDateTimeWithSeconds(row.createdAt)}</p>
                  {viewMode === "history" && row.readAt ? (
                    <p className="admin-notification-when admin-notification-handled-at">
                      対応済み {formatSiteDateTimeWithSeconds(row.readAt)}
                    </p>
                  ) : null}
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
                    {viewMode === "unread" ? (
                      <button
                        type="button"
                        className="admin-small-button"
                        disabled={sendingRecoveryId === row.id}
                        onClick={() => void markRead(row.id)}
                      >
                        無視
                      </button>
                    ) : null}
                  </div>
                </li>
              ) : row.kind === "signup" ? (
                <li
                  key={row.id}
                  className={`room-notification-reply-card room-notification-admin-recovery${
                    viewMode === "history" ? " is-history" : " is-unread"
                  }`}
                >
                  <span className="room-notification-push-kind">新規登録</span>
                  <p className="admin-notification-when">{formatSiteDateTimeWithSeconds(row.createdAt)}</p>
                  {viewMode === "history" && row.readAt ? (
                    <p className="admin-notification-when admin-notification-handled-at">
                      確認済み {formatSiteDateTimeWithSeconds(row.readAt)}
                    </p>
                  ) : null}
                  <p className="room-notification-reply-lead">
                    <span className="admin-notification-label">呼び名</span> {row.guestName}
                  </p>
                  <p className="admin-notification-letter-preview">
                    <span className="admin-notification-label">場面</span> {row.memo}
                  </p>
                  <p className="admin-notification-letter-preview">
                    <span className="admin-notification-label">ユーザーID</span> {row.guestId}
                  </p>
                  <p className="admin-notification-letter-preview">
                    <span className="admin-notification-label">控えメール</span>{" "}
                    {row.emailSent ? "送付済み（宛先は保存していません）" : "未送付（宛先は保存していません）"}
                  </p>
                  <div className="admin-notification-item-actions">
                    <a
                      href="/admin/ledger"
                      className="room-notification-seal-button"
                      onClick={() => setOpen(false)}
                    >
                      ユーザー管理を開く
                    </a>
                    {viewMode === "unread" ? (
                      <button type="button" className="admin-small-button" onClick={() => void markRead(row.id)}>
                        確認した
                      </button>
                    ) : null}
                  </div>
                </li>
              ) : (
                <li
                  key={row.id}
                  className={`room-notification-reply-card${viewMode === "history" ? " is-history" : " is-unread"}`}
                >
                  <span className="room-notification-push-kind">文通</span>
                  <p className="admin-notification-when">{formatSiteDateTimeWithSeconds(row.createdAt)}</p>
                  {viewMode === "history" && row.readAt ? (
                    <p className="admin-notification-when admin-notification-handled-at">
                      対応済み {formatSiteDateTimeWithSeconds(row.readAt)}
                    </p>
                  ) : null}
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
                  {viewMode === "unread" ? (
                    <div className="admin-notification-item-actions">
                      <button type="button" className="admin-small-button" onClick={() => void markRead(row.id)}>
                        対応済み
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </>
  ) : null;

  return (
    <div className="admin-notification-wrap">
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
