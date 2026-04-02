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

export async function GET(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const viewParam = new URL(request.url).searchParams.get("view");
  const view: RoomNotificationView = viewParam === "history" ? "history" : "unread";

  const accountStartedAtIso = await getGuestAccountStartedAtIso(session.guestId);
  await ensureGuestNotificationBaseline(session.guestId, accountStartedAtIso);
  const reads = await getGuestNotificationReadsMap(session.guestId);
  const baselineIso = reads["__baseline_v1"];

  const allContents = await listContents();
  const slugBySlugKey = new Map(
    allContents.map((item) => [normalizeThreadKey(item.slug), item.slug] as const)
  );

  const unreadItems = await buildUnreadRoomNotifications(
    session.guestId,
    reads,
    baselineIso,
    slugBySlugKey,
    accountStartedAtIso
  );
  const unreadCount = unreadItems.length;

  const items =
    view === "history"
      ? await buildHistoryRoomNotifications(session.guestId, reads, slugBySlugKey, accountStartedAtIso)
      : unreadItems;

  return NextResponse.json({
    ok: true,
    items,
    unreadCount,
    view
  });
}

export async function PATCH(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string };
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await markGuestNotificationRead(session.guestId, id);
  pingRoomNotificationSubscriber(session.guestId);
  return NextResponse.json({ ok: true });
}
