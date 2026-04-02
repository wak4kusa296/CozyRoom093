import webpush from "web-push";
import { adminStub } from "@/lib/auth";
import {
  listAllPushSubscriptions,
  listSubscriptionsForGuests,
  removeGuestPushSubscription,
  type PushSubscriptionJSON
} from "@/lib/push-subscriptions";
import { getVapidConfig } from "@/lib/web-push-config";

/** Service Worker の push ハンドラが期待する JSON（public/sw.js と揃える） */
export type WebPushDataPayload = {
  title: string;
  body: string;
  /** 通知タップで開くパス（/ で始まる）または絶対 URL */
  url: string;
};

async function sendJsonToTargets(
  targets: Array<{ guestId: string; subscription: PushSubscriptionJSON }>,
  json: string
): Promise<void> {
  const cfg = getVapidConfig();
  if (!cfg || targets.length === 0) return;

  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

  for (const { guestId, subscription } of targets) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys!.p256dh,
            auth: subscription.keys!.auth
          }
        },
        json,
        { TTL: 86400 }
      );
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeGuestPushSubscription(guestId, subscription.endpoint);
      } else {
        console.error("[web-push-deliver] send failed", { guestId, statusCode: err.statusCode });
      }
    }
  }
}

/** 指定ゲスト ID の購読端末へ（管理人からの文通返信など） */
export async function sendWebPushToGuestIds(guestIds: string[], payload: WebPushDataPayload): Promise<void> {
  const unique = [...new Set(guestIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return;
  const targets = await listSubscriptionsForGuests(unique);
  await sendJsonToTargets(targets, JSON.stringify(payload));
}

/** 購読している全端末へ（新記事初公開・手動プッシュは別経路で既に実装） */
export async function sendWebPushToAllSubscribers(payload: WebPushDataPayload): Promise<void> {
  const targets = await listAllPushSubscriptions();
  await sendJsonToTargets(targets, JSON.stringify(payload));
}

/** guestId=admin として登録した端末へ（管理人向け通知） */
export async function sendWebPushToAdminSubscribers(payload: WebPushDataPayload): Promise<void> {
  await sendWebPushToGuestIds([adminStub.id], payload);
}
