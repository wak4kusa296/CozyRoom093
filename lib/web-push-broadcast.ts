import webpush from "web-push";
import type { BroadcastPush } from "@/lib/broadcast-pushes";
import {
  listAllPushSubscriptions,
  listSubscriptionsForGuests,
  removeGuestPushSubscription,
  type PushSubscriptionJSON
} from "@/lib/push-subscriptions";
import { getVapidConfig } from "@/lib/web-push-config";

export type WebPushBroadcastResult = {
  /** VAPID 未設定のときのみ */
  skippedReason: "vapid_not_configured" | null;
  targetCount: number;
  sentCount: number;
  failureCount: number;
};

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
 * 管理画面のブロードキャスト保存後に呼ぶ。VAPID 未設定時は送信せず理由を返す。
 * 呼び出し側はサーバーレスでレスポンス返却後に処理が切れないよう **await** すること。
 */
export async function sendWebPushForBroadcast(row: BroadcastPush): Promise<WebPushBroadcastResult> {
  const cfg = getVapidConfig();
  if (!cfg) {
    return {
      skippedReason: "vapid_not_configured",
      targetCount: 0,
      sentCount: 0,
      failureCount: 0
    };
  }

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

  let sentCount = 0;
  let failureCount = 0;

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
      sentCount += 1;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeGuestPushSubscription(guestId, subscription.endpoint);
      } else {
        failureCount += 1;
        console.error("[web-push-broadcast] send failed", {
          guestId,
          statusCode: err.statusCode,
          message: err.message
        });
      }
    }
  }

  return {
    skippedReason: null,
    targetCount: targets.length,
    sentCount,
    failureCount
  };
}
