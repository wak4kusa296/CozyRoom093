/**
 * 通知センターの「通知を許可」表示判定。
 * PushManager は環境によって未定義のことがある（例: iOS Safari 通常閲覧）ため表示条件に含めない。
 * VAPID あり・かつブラウザの通知権限が granted でないとき true。
 */
export async function shouldShowPermitPushButton(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "granted") {
    return false;
  }
  try {
    const res = await fetch("/api/room/push-subscribe", {
      cache: "no-store",
      credentials: "same-origin"
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { vapidPublicKey?: string | null };
    return Boolean(data.vapidPublicKey?.trim());
  } catch {
    return false;
  }
}
