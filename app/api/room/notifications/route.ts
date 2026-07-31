import { NextResponse } from "next/server";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { listContents } from "@/lib/content";
import { normalizeThreadKey } from "@/lib/letters";
import { getGuestAccountStartedAtIso } from "@/lib/guest-credentials";
import {
  ensureGuestNotificationBaseline,
  getGuestNotificationReadsMap,
  markGuestNotificationRead
} from "@/lib/guest-notification-reads";
import { pingRoomNotificationSubscriber } from "@/lib/notification-push";
import { buildHistoryRoomNotifications, buildUnreadRoomNotifications } from "@/lib/room-notifications-query";
import type { RoomNotificationView } from "@/lib/room-notifications";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http-json";

export async function GET(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return jsonError("unauthorized", "ログインが必要です。", { status: 401 });
  }

  const viewParam = new URL(request.url).searchParams.get("view");
  const view: RoomNotificationView = viewParam === "history" ? "history" : "unread";

  const accountStartedAtIso = await getGuestAccountStartedAtIso(session.guestId);
  await ensureGuestNotificationBaseline(session.guestId, accountStartedAtIso);
  const reads = await getGuestNotificationReadsMap(session.guestId);
  const baselineIso = reads["__baseline_v1"];
  /** 台帳日時が取れない環境では、初回ベースライン時刻で「登録前」に近い除外を行う */
  const registrationCutoffIso = accountStartedAtIso ?? baselineIso ?? undefined;

  const allContents = await listContents();
  const slugBySlugKey = new Map(
    allContents.map((item) => [normalizeThreadKey(item.slug), item.slug] as const)
  );

  const unreadItems = await buildUnreadRoomNotifications(
    session.guestId,
    reads,
    baselineIso,
    slugBySlugKey,
    registrationCutoffIso
  );
  const unreadCount = unreadItems.length;

  const items =
    view === "history"
      ? await buildHistoryRoomNotifications(session.guestId, reads, slugBySlugKey, registrationCutoffIso)
      : unreadItems;

  return jsonOk({
    items,
    unreadCount,
    view
  });
}

export async function PATCH(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return jsonError("unauthorized", "ログインが必要です。", { status: 401 });
  }

  const body = await parseJsonBody<{ id?: string }>(request);
  if (!body) return jsonError("invalid_json", "送信内容を読み取れませんでした。", { status: 400 });
  const id = String(body.id ?? "").trim();
  if (!id) {
    return jsonError("invalid_notification_id", "通知を指定してください。", { status: 400 });
  }

  await markGuestNotificationRead(session.guestId, id);
  pingRoomNotificationSubscriber(session.guestId);
  return jsonOk({});
}
