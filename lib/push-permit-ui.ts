/**
 * 通知センター「通知を許可」表示判定。
 * - VAPID が有効なときだけ（NEXT_PUBLIC または GET で確認）
 * - 通知権限が未選択なら表示（拒否済みには非動作の許可ボタンを出さない）
 * - 権限付与済みでも Push 購読が無ければ表示（subscribeRoomPush で登録）
 */

function vapidConfiguredFromEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim());
}

async function vapidConfiguredFromApi(): Promise<boolean> {
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

export async function shouldShowPermitPushButton(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  const hasVapid = vapidConfiguredFromEnv() || (await vapidConfiguredFromApi());
  if (!hasVapid) return false;

  if (Notification.permission === "default") {
    return true;
  }
  if (Notification.permission === "denied") return false;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    await navigator.serviceWorker.register("/sw.js").catch(() => {});
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub === null;
  } catch {
    return false;
  }
}
