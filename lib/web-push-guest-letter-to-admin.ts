import { normalizeThreadKey } from "@/lib/letters";
import { sendWebPushToAdminSubscribers } from "@/lib/web-push-deliver";

/**
 * ゲストが手紙を送ったとき、管理者端末の Web Push 購読へ通知する。
 * 購読は `/api/room/push-subscribe` で管理者セッション（guestId=admin）として登録されたもの。
 */
export async function sendWebPushGuestLetterToAdmins(payload: {
  slug: string;
  guestId: string;
  senderName: string;
}): Promise<void> {
  const slugKey = normalizeThreadKey(payload.slug);
  const guestKey = normalizeThreadKey(payload.guestId);
  const url = `/admin/letters?slug=${encodeURIComponent(slugKey)}&guest=${encodeURIComponent(guestKey)}`;
  const name = payload.senderName.trim() || "ゲスト";

  await sendWebPushToAdminSubscribers({
    title: "手紙が届きました",
    body: `${name}さんからの便りです。`,
    url
  });
}
