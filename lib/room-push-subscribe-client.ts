/** ルームの Web Push 購読（クライアント専用・バナー／通知センターから利用） */

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type RoomPushSubscribeResult = "granted" | "denied" | "no-vapid" | "unsupported";

export async function subscribeRoomPush(): Promise<RoomPushSubscribeResult> {
  if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) {
    return "unsupported";
  }
  const res = await fetch("/api/room/push-subscribe", { cache: "no-store" });
  const data = (await res.json()) as { vapidPublicKey?: string | null };
  if (!data.vapidPublicKey) return "no-vapid";

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "denied";

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
  return "granted";
}
