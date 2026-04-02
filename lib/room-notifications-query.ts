import {
  getBroadcastPushById,
  listBroadcastPushes,
  pushAppliesToGuest
} from "@/lib/broadcast-pushes";
import { listPublicContents } from "@/lib/content";
import { listAdminLetterEventsForGuest, normalizeThreadKey } from "@/lib/letters";
import type {
  RoomNotificationContentItem,
  RoomNotificationItem,
  RoomNotificationPushItem,
  RoomNotificationReplyItem
} from "@/lib/room-notifications";

/**
 * アカウント登録より前の「サイト全体向け」通知だけ除外する。
 * 文通（adminLetter）はゲスト行があって初めて存在するため、created_at 基準では切らない。
 */
function isBeforeGuestAccount(eventIso: string, accountStartedAtIso: string | null | undefined): boolean {
  if (!accountStartedAtIso) return false;
  return new Date(eventIso).getTime() < new Date(accountStartedAtIso).getTime();
}

function parseAdminLetterNotificationId(id: string): { slugKey: string; guestKey: string; createdAt: string } | null {
  if (!id.startsWith("adminLetter|")) return null;
  const rest = id.slice("adminLetter|".length);
  const parts = rest.split("|");
  if (parts.length < 3) return null;
  const slugKey = parts[0] ?? "";
  const guestKey = parts[1] ?? "";
  const createdAt = parts.slice(2).join("|");
  if (!slugKey || !guestKey || !createdAt) return null;
  return { slugKey, guestKey, createdAt };
}

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
    if (isBeforeGuestAccount(published, accountStartedAtIso)) continue;
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
    if (baselineIso && row.createdAt <= baselineIso) continue;
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
    if (isBeforeGuestAccount(p.sentAt, accountStartedAtIso)) continue;
    const id = `push|${p.id}`;
    if (reads[id]) continue;
    if (baselineIso && p.sentAt <= baselineIso) continue;
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
  accountStartedAtIso?: string | null
): Promise<RoomNotificationItem[]> {
  const guestKeyExpected = normalizeThreadKey(guestId);

  const adminLetters = await listAdminLetterEventsForGuest(guestId);
  const bodyById = new Map(adminLetters.map((r) => [r.id, r.body] as const));

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
      if (isBeforeGuestAccount(p.sentAt, accountStartedAtIso)) continue;
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
      const parsed = parseAdminLetterNotificationId(key);
      if (!parsed) continue;
      // DB の guest_id が正規化前の値でも、セッション側と同一人物なら履歴に出す
      if (
        normalizeThreadKey(parsed.guestKey) !== guestKeyExpected &&
        parsed.guestKey.trim() !== guestId.trim()
      ) {
        continue;
      }
      const slugKeyNorm = normalizeThreadKey(parsed.slugKey);
      const slug = slugBySlugKey.get(slugKeyNorm) ?? slugBySlugKey.get(parsed.slugKey) ?? parsed.slugKey;
      out.push({
        kind: "reply",
        id: key,
        slugKey: parsed.slugKey,
        slug,
        body: bodyById.get(key) ?? "",
        createdAt: parsed.createdAt,
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
