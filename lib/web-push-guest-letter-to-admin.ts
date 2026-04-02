import webpush from "web-push";
import {
  listSubscriptionsForGuests,
  removeGuestPushSubscription,
  type PushSubscriptionJSON
} from "@/lib/push-subscriptions";
import { getVapidConfig } from "@/lib/web-push-config";
import { adminStub } from "@/lib/auth";
import { normalizeThreadKey } from "@/lib/letters";

/**
 * ゲストが手紙を送ったとき、管理者端末の Web Push 購読へ通知する。
 * 購読は `/api/room/push-subscribe` で管理者セッション（guestId=admin）として登録されたもの。
 */
export async function sendWebPushGuestLetterToAdmins(payload: {
  slug: string;
  guestId: string;
  senderName: string;
}): Promise<void> {
  const cfg = getVapidConfig();
  if (!cfg) return;

  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

  const targets = await listSubscriptionsForGuests([adminStub.id]);
  if (targets.length === 0) return;

  const slugKey = normalizeThreadKey(payload.slug);
  const guestKey = normalizeThreadKey(payload.guestId);
  const url = `/admin/letters?slug=${encodeURIComponent(slugKey)}&guest=${encodeURIComponent(guestKey)}`;
  const name = payload.senderName.trim() || "ゲスト";

  const body = JSON.stringify({
    title: "手紙が届きました",
    body: `${name}さんからの便りです。`,
    url
  });

  for (const { guestId, subscription } of targets) {
    await sendOne(guestId, subscription, body);
  }
}

async function sendOne(guestId: string, subscription: PushSubscriptionJSON, body: string): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys!.p256dh,
          auth: subscription.keys!.auth
        }
      },
      body,
      { TTL: 86400 }
    );
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 410 || err.statusCode === 404) {
      await removeGuestPushSubscription(guestId, subscription.endpoint);
    }
  }
}
