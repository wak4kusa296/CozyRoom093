import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeIcon } from "@/app/components/home-icon";
import { getSession } from "@/lib/auth";
import { listContents, normalizeSlugParam } from "@/lib/content";
import { getGuestNotificationReadsMap } from "@/lib/guest-notification-reads";
import {
  FAN_LETTER_SLUG,
  isStandaloneLetterSlug,
  letterThreadDisplayTitle,
  listAdminLetterEventsForGuest,
  listLetterThreadsForGuest,
  normalizeThreadKey
} from "@/lib/letters";
import { RoomLettersClient } from "./room-letters-client";

export const dynamic = "force-dynamic";

export default async function RoomLettersPage({
  searchParams
}: {
  searchParams: Promise<{ letters?: string | string[]; thread?: string | string[]; guest?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const resolved = await searchParams;
  const lettersParam = Array.isArray(resolved.letters) ? resolved.letters[0] ?? "" : resolved.letters ?? "";
  const threadParam = Array.isArray(resolved.thread) ? resolved.thread[0] ?? "" : resolved.thread ?? "";
  const guestFromQuery = Array.isArray(resolved.guest) ? resolved.guest[0] ?? "" : resolved.guest ?? "";

  const targetGuestId = session.role === "admin" && guestFromQuery ? guestFromQuery : session.guestId;
  const markThreadReadOnOpen =
    session.role === "guest" || (session.role === "admin" && !guestFromQuery);

  const [threads, contents, adminEvents, readsMap] = await Promise.all([
    listLetterThreadsForGuest(targetGuestId),
    listContents(),
    listAdminLetterEventsForGuest(targetGuestId),
    getGuestNotificationReadsMap(targetGuestId)
  ]);

  const unreadBySlugKey = new Map<string, number>();
  for (const event of adminEvents) {
    if (readsMap[event.id]) continue;
    unreadBySlugKey.set(event.slugKey, (unreadBySlugKey.get(event.slugKey) ?? 0) + 1);
  }

  const titleBySlugKey = new Map(contents.map((item) => [normalizeThreadKey(item.slug), item.title]));
  const slugBySlugKey = new Map(contents.map((item) => [normalizeThreadKey(item.slug), item.slug]));

  const threadItems = threads.map((thread) => {
    const contentSlug = isStandaloneLetterSlug(thread.slugKey)
      ? thread.slugKey
      : (slugBySlugKey.get(thread.slugKey) ?? thread.slugKey);
    const title = letterThreadDisplayTitle(
      thread.slugKey,
      titleBySlugKey.get(thread.slugKey),
      thread.title
    );
    return {
      slugKey: thread.slugKey,
      contentSlug,
      title,
      count: thread.count,
      latestAt: thread.latestAt,
      latestBody: thread.latestBody,
      latestIsAdmin: thread.latestSenderRole === "admin",
      unreadCount: unreadBySlugKey.get(thread.slugKey) ?? 0,
      // モーダルを開いた時点で letter-section.tsx 側が本文を取得するため、ここでは先読みしない
      initialLetters: []
    };
  });

  const openThreadRaw = threadParam ? normalizeSlugParam(threadParam) : "";
  // レガシー互換: ?letters=open は旧 __fan 導線向け。新規導線では発生しない（削除予定）。
  const legacyOpenFan = lettersParam === "open" && !openThreadRaw;
  const initialOpenSlug = openThreadRaw
    ? isStandaloneLetterSlug(openThreadRaw)
      ? normalizeThreadKey(openThreadRaw)
      : slugBySlugKey.get(normalizeThreadKey(openThreadRaw)) ?? openThreadRaw
    : legacyOpenFan
      ? FAN_LETTER_SLUG
      : null;

  return (
    <main className="room-letters-page">
      <nav className="article-breadcrumb room-letters-breadcrumb section-title section-title-sub" aria-label="パンくず">
        <Link href="/room" className="room-top-page-link">
          <HomeIcon />
          トップページ
        </Link>
        <span aria-hidden="true">/</span>
        <span>文通</span>
      </nav>

      <header className="room-letters-header">
        <h1>文通</h1>
        <p className="lead">管理人との往復書簡を、ここで書けます。これまでの便りもまとめて読めます。</p>
      </header>

      <RoomLettersClient
        guestId={targetGuestId}
        markThreadReadOnOpen={markThreadReadOnOpen}
        threads={threadItems}
        initialOpenSlug={initialOpenSlug}
      />
    </main>
  );
}
