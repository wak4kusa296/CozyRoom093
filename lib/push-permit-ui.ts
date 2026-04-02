/** VAPID ありかつ Notification.permission !== granted のとき true（ルーム／管理の通知センター用） */
export async function shouldShowPermitPushButton(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) {
    return false;
  }
  try {
    const res = await fetch("/api/room/push-subscribe", { cache: "no-store" });
    const data = (await res.json()) as { vapidPublicKey?: string | null };
    if (!data.vapidPublicKey) return false;
    return Notification.permission !== "granted";
  } catch {
    return false;
  }
}
