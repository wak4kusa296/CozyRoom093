import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { AdminLettersReplyForm } from "@/app/admin/letters/admin-letters-reply-form";
import { listContents } from "@/lib/content";
import { getLetters, listLetterThreads, markAllGuestLetterNotificationReadsForAdminThread, normalizeThreadKey } from "@/lib/letters";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";
import { listGuestCredentialsWithStatus } from "@/lib/guest-credentials";
import Link from "next/link";

export default async function AdminLettersPage({
  searchParams
}: {
  searchParams: Promise<{ slug?: string | string[]; guest?: string | string[] }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const slugFilter = Array.isArray(resolvedSearchParams.slug)
    ? resolvedSearchParams.slug[0] ?? ""
    : resolvedSearchParams.slug ?? "";
  const guestFilter = Array.isArray(resolvedSearchParams.guest)
    ? resolvedSearchParams.guest[0] ?? ""
    : resolvedSearchParams.guest ?? "";
  const normalizedSlugFilter = slugFilter ? normalizeThreadKey(slugFilter) : "";
  const normalizedGuestFilter = guestFilter ? normalizeThreadKey(guestFilter) : "";
  const [threads, contents, guests] = await Promise.all([
    listLetterThreads(),
    listContents(),
    listGuestCredentialsWithStatus().catch(() => [])
  ]);
  const titleBySlugKey = new Map(contents.map((item) => [normalizeThreadKey(item.slug), item.title]));
  const slugBySlugKey = new Map(contents.map((item) => [normalizeThreadKey(item.slug), item.slug]));
  const guestIdByGuestKey = new Map(guests.map((item) => [normalizeThreadKey(item.guestId), item.guestId]));
  const nameByGuestKey = new Map(guests.map((item) => [normalizeThreadKey(item.guestId), item.guestName]));
  const filteredThreads = normalizedSlugFilter
    ? threads.filter((thread) => thread.slugKey === normalizedSlugFilter)
    : threads;
  const selectedThread = normalizedGuestFilter
    ? filteredThreads.find((thread) => thread.guestKey === normalizedGuestFilter) ?? null
    : null;
  const selectedSlug = selectedThread ? (slugBySlugKey.get(selectedThread.slugKey) ?? selectedThread.slugKey) : "";
  const selectedGuestId = selectedThread
    ? (guestIdByGuestKey.get(selectedThread.guestKey) ?? selectedThread.guestKey)
    : "";
  const selectedDisplayName = selectedThread
    ? (nameByGuestKey.get(selectedThread.guestKey) ?? selectedThread.guestKey)
    : "";
  const selectedTitle = selectedThread ? (titleBySlugKey.get(selectedThread.slugKey) ?? selectedThread.slugKey) : "";
  const selectedLetters =
    selectedThread && selectedSlug && selectedGuestId ? await getLetters(selectedSlug, selectedGuestId) : [];
  const closeHref = slugFilter ? `/admin/letters?slug=${encodeURIComponent(slugFilter)}` : "/admin/letters";

  if (normalizedSlugFilter && normalizedGuestFilter) {
    await markAllGuestLetterNotificationReadsForAdminThread(normalizedSlugFilter, normalizedGuestFilter);
    pingAdminNotificationSubscribers();
  }

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card">
        <div className="admin-page-header">
          <h1>文通管理</h1>
          <p className="lead">各スレッドの最新状況を確認できます。</p>
        </div>
        <AdminNav />

        {filteredThreads.length === 0 ? (
          <p className="meta">まだ文通スレッドはありません。</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table admin-letters-table">
              <thead>
                <tr>
                  <th>スレッド</th>
                </tr>
              </thead>
              <tbody>
                {filteredThreads.map((thread) => {
                  const contentTitle = titleBySlugKey.get(thread.slugKey) ?? thread.slugKey;
                  const contentSlug = slugBySlugKey.get(thread.slugKey) ?? thread.slugKey;
                  const displayName = nameByGuestKey.get(thread.guestKey) ?? thread.guestKey;
                  const isConfirmed = thread.latestSender === "管理者";

                  return (
                    <tr key={`${thread.slugKey}__${thread.guestKey}`}>
                      <td>
                        <Link
                          href={`/admin/letters?slug=${encodeURIComponent(contentSlug)}&guest=${encodeURIComponent(thread.guestKey)}`}
                          className="admin-letters-row-link"
                        >
                          <span className="admin-letters-row-title">{contentTitle}</span>
                          <span className="admin-letters-row-user">{displayName}</span>
                          <span className={`admin-letters-row-status ${isConfirmed ? "is-confirmed" : "is-pending"}`}>
                            {isConfirmed ? "確認済み" : "未確認"}
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedThread ? (
          <div className="letter-modal-backdrop">
            <section className="letters letter-modal" role="dialog" aria-modal="true" aria-label="文通欄">
              <div className="letter-modal-header">
                <div className="admin-letter-modal-title-block">
                  <h2>
                    {selectedTitle} / {selectedDisplayName}
                  </h2>
                  <Link
                    href={`/room/${encodeURIComponent(selectedSlug)}?guest=${encodeURIComponent(selectedGuestId)}`}
                    className="text-link admin-letter-open-article"
                  >
                    記事ページへ
                  </Link>
                </div>
                <div className="admin-letter-modal-actions">
                  <Link href={closeHref} className="ghost letter-close-button" aria-label="閉じる">
                    close
                  </Link>
                </div>
              </div>
              <p className="meta">このやり取りは {selectedDisplayName} と管理者だけに見えます。</p>
              <div className="thread">
                {selectedLetters.length === 0 ? <p className="meta">まだ便りはありません。</p> : null}
                {selectedLetters.map((letter, index) => {
                  const normalizedSender = letter.sender.trim().toLowerCase();
                  const isAdmin = normalizedSender === "管理者" || normalizedSender === "admin";
                  return (
                    <article key={`${letter.createdAt}-${index}`} className={`letter-item ${isAdmin ? "is-admin" : "is-you"}`}>
                      <p className="sender">{isAdmin ? "管理者" : selectedDisplayName}</p>
                      <p>{letter.body}</p>
                    </article>
                  );
                })}
              </div>
              <AdminLettersReplyForm>
                <input type="hidden" name="slug" value={selectedSlug} />
                <input type="hidden" name="guestId" value={selectedGuestId} />
                <textarea name="body" rows={4} placeholder={`${selectedDisplayName}への返信`} required />
              </AdminLettersReplyForm>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
