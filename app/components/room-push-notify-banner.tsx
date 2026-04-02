"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_DISMISS_KEY = "room-push-banner-dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const DEFAULT_DESCRIPTION =
  "プッシュ通知を、スマホやPCの通知バーでも受け取れます（ルームのベル通知と同じ内容です）。";

/**
 * VAPID 設定済みのとき、ブラウザ／OS の通知購読を案内する。
 */
export function RoomPushNotifyBanner({
  enabled,
  description = DEFAULT_DESCRIPTION,
  dismissStorageKey = DEFAULT_DISMISS_KEY
}: {
  enabled: boolean;
  /** 案内文（ルーム／管理で差し替え可） */
  description?: string;
  /** localStorage のキー（ルームと管理で別々に「あとで」を保存する） */
  dismissStorageKey?: string;
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(dismissStorageKey) === "1";
    } catch {
      return false;
    }
  });

  const [phase, setPhase] = useState<
    "init" | "no-vapid" | "hidden" | "prompt" | "subscribed" | "denied"
  >("init");

  useEffect(() => {
    if (!enabled || dismissed) return;
    if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) {
      setPhase("hidden");
      return;
    }

    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/room/push-subscribe", { cache: "no-store" });
      const data = (await res.json()) as { vapidPublicKey?: string | null };
      if (cancelled) return;
      if (!data.vapidPublicKey) {
        setPhase("no-vapid");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      const perm = Notification.permission;

      if (perm === "denied") {
        setPhase("denied");
        return;
      }

      if (sub && perm === "granted") {
        await fetch("/api/room/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON())
        });
        setPhase("subscribed");
        return;
      }

      setPhase("prompt");
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, dismissed, dismissStorageKey]);

  const onEnable = useCallback(async () => {
    const res = await fetch("/api/room/push-subscribe", { cache: "no-store" });
    const data = (await res.json()) as { vapidPublicKey?: string | null };
    if (!data.vapidPublicKey) return;

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setPhase("denied");
      return;
    }

    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey) as BufferSource
    });

    await fetch("/api/room/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON())
    });
    setPhase("subscribed");
  }, []);

  const onDismiss = useCallback(() => {
    try {
      localStorage.setItem(dismissStorageKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setPhase("hidden");
  }, [dismissStorageKey]);

  if (!enabled || phase === "init" || phase === "no-vapid" || phase === "hidden" || dismissed) {
    return null;
  }
  if (phase === "subscribed") {
    return null;
  }

  if (phase === "denied") {
    return (
      <div className="room-push-notify-banner room-push-notify-banner--denied" role="status">
        <p className="room-push-notify-banner-text">
          ブラウザの通知がブロックされています。ブラウザのサイト設定から許可できます。
        </p>
        <button type="button" className="room-push-notify-banner-close" onClick={onDismiss} aria-label="閉じる">
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="room-push-notify-banner" role="region" aria-label="ブラウザ通知">
      <p className="room-push-notify-banner-text">{description}</p>
      <div className="room-push-notify-banner-actions">
        <button type="button" className="room-push-notify-banner-primary" onClick={() => void onEnable()}>
          通知を許可する
        </button>
        <button type="button" className="room-push-notify-banner-secondary" onClick={onDismiss}>
          あとで
        </button>
      </div>
    </div>
  );
}
