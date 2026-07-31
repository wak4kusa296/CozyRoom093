import {
  getBroadcastPushById,
  listBroadcastPushes,
  pushAppliesToGuest
} from "@/lib/broadcast-pushes";
import { listPublicContents } from "@/lib/content";
import { listAdminLetterEventsForGuest, normalizeThreadKey } from "@/lib/letters";
import { isEventAtOrBeforeCutoff, isEventStrictlyBeforeCutoff } from "@/lib/notification-account-window";
import type {
  RoomNotificationContentItem,
  RoomNotificationItem,
  RoomNotificationPushItem,
  RoomNotificationReplyItem
} from "@/lib/room-notifications";

/** 文通（adminLetter）はゲスト行があって初めて存在するため、アカウント日時では切らない。 */

export async function buildUnreadRoomNotifications(
  guestId: string,
  reads: Record<string, string>,
  baselineIso: string | undefined,
  slugBySlugKey: Map<string, string>,
  accountStartedAtIso?: string | null
): Promise<RoomNotificationItem[]> {
  const publicItems = await listPublicContents();
  const contentItems: RoomNotificationContentItem[] = [];
  for (const item of publicItems) {
    const published = item.published_at ?? item.date;
    if (isEventStrictlyBeforeCutoff(published, accountStartedAtIso)) continue;
    const id = `content|${item.slug}`;
    if (reads[id]) continue;
    contentItems.push({
      kind: "content",
      id,
      slug: item.slug,
      title: item.title,
      createdAt: item.published_at ?? item.date
    });
  }

  const adminLetters = await listAdminLetterEventsForGuest(guestId);
  const replyItems: RoomNotificationReplyItem[] = [];
  for (const row of adminLetters) {
    if (reads[row.id]) continue;
    if (isEventAtOrBeforeCutoff(row.createdAt, baselineIso)) continue;
    replyItems.push({
      kind: "reply",
      id: row.id,
      slugKey: row.slugKey,
      slug: slugBySlugKey.get(row.slugKey) ?? row.slugKey,
      body: row.body,
      createdAt: row.createdAt
    });
  }

  const broadcasts = await listBroadcastPushes();
  const pushItems: RoomNotificationPushItem[] = [];
  for (const p of broadcasts) {
    if (!pushAppliesToGuest(p, guestId)) continue;
    if (isEventStrictlyBeforeCutoff(p.sentAt, accountStartedAtIso)) continue;
    const id = `push|${p.id}`;
    if (reads[id]) continue;
    if (isEventAtOrBeforeCutoff(p.sentAt, baselineIso)) continue;
    pushItems.push({
      kind: "push",
      id,
      title: p.title,
      body: p.body,
      createdAt: p.sentAt,
      lead: p.lead,
      linkUrl: p.linkUrl,
      linkLabel: p.linkLabel,
      imageUrl: p.imageUrl
    });
  }

  return [...contentItems, ...replyItems, ...pushItems].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );
}

export async function buildHistoryRoomNotifications(
  guestId: string,
  reads: Record<string, string>,
  slugBySlugKey: Map<string, string>,
  registrationCutoffIso?: string | null
): Promise<RoomNotificationItem[]> {
  const adminLetters = await listAdminLetterEventsForGuest(guestId);
  const eventById = new Map(adminLetters.map((e) => [e.id, e] as const));

  const out: RoomNotificationItem[] = [];

  for (const [key, readAt] of Object.entries(reads)) {
    if (key === "__baseline_v1") continue;
    if (key.startsWith("guestReply|")) continue;

    if (key.startsWith("content|")) {
      continue;
    }

    if (key.startsWith("push|")) {
      const pushId = key.slice("push|".length);
      if (!pushId) continue;
      const p = await getBroadcastPushById(pushId);
      if (!p || !pushAppliesToGuest(p, guestId)) continue;
      if (isEventStrictlyBeforeCutoff(p.sentAt, registrationCutoffIso)) continue;
      out.push({
        kind: "push",
        id: key,
        title: p.title,
        body: p.body,
        createdAt: p.sentAt,
        readAt,
        lead: p.lead,
        linkUrl: p.linkUrl,
        linkLabel: p.linkLabel,
        imageUrl: p.imageUrl
      });
      continue;
    }

    if (key.startsWith("adminLetter|")) {
      const event = eventById.get(key);
      if (!event) continue;
      const slug = slugBySlugKey.get(normalizeThreadKey(event.slugKey)) ?? event.slugKey;
      out.push({
        kind: "reply",
        id: key,
        slugKey: event.slugKey,
        slug,
        body: event.body,
        createdAt: event.createdAt,
        readAt
      });
    }
  }

  return out.sort((a, b) => {
    const ra = ("readAt" in a && a.readAt ? a.readAt : "") || "";
    const rb = ("readAt" in b && b.readAt ? b.readAt : "") || "";
    return ra < rb ? 1 : ra > rb ? -1 : 0;
  });
}
