import webpush from "web-push";
import type { BroadcastPush } from "@/lib/broadcast-pushes";
import {
  listAllPushSubscriptions,
  listSubscriptionsForGuests,
  removeGuestPushSubscription,
  type PushSubscriptionJSON
} from "@/lib/push-subscriptions";
import { getVapidConfig } from "@/lib/web-push-config";

function notifyBody(row: BroadcastPush): string {
  const lead = row.lead?.trim();
  if (lead) return lead;
  const b = row.body.trim();
  return b.length > 180 ? `${b.slice(0, 180)}…` : b;
}

function notifyUrl(row: BroadcastPush): string {
  const u = row.linkUrl?.trim();
  if (!u) return "/room";
  if (u.startsWith("/")) return u;
  return u;
}

/**
 * 管理画面のブロードキャスト保存後に呼ぶ。VAPID 未設定時は何もしない。
 */
export async function sendWebPushForBroadcast(row: BroadcastPush): Promise<void> {
  const cfg = getVapidConfig();
  if (!cfg) return;

  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

  const targets: Array<{ guestId: string; subscription: PushSubscriptionJSON }> =
    row.audience === "all"
      ? await listAllPushSubscriptions()
      : await listSubscriptionsForGuests(row.guestIds);

  const payload = JSON.stringify({
    title: row.title,
    body: notifyBody(row),
    url: notifyUrl(row)
  });

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
        payload,
        { TTL: 86400 }
      );
    } catch (e: unknown) {
      const err = e as { statusCode?: number };
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeGuestPushSubscription(guestId, subscription.endpoint);
      }
    }
  }
}
