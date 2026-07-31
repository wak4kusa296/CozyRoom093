import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { AdminLettersComposeForm } from "@/app/admin/letters/admin-letters-compose-form";
import { AdminLetterThreadModal } from "@/app/admin/letters/admin-letter-thread-modal";
import { listContents } from "@/lib/content";
import { listLetterThreads, normalizeThreadKey } from "@/lib/letters";
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
  const closeHref = slugFilter ? `/admin/letters?slug=${encodeURIComponent(slugFilter)}` : "/admin/letters";
  const composeGuests = guests
    .filter((guest) => guest.isActive)
    .map((guest) => ({ guestId: guest.guestId, guestName: guest.guestName }));

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card admin-letters-page">
        <div className="admin-page-header">
          <h1>文通管理</h1>
          <p className="lead">各スレッドの最新状況を確認できます。</p>
        </div>
        <AdminNav />
        <section className="admin-letters-compose-section" aria-labelledby="admin-letters-compose-heading">
          <h2 id="admin-letters-compose-heading">新しいお手紙</h2>
          <AdminLettersComposeForm guests={composeGuests} />
        </section>

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
                  const isConfirmed = thread.latestSenderRole === "admin";

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
          <AdminLetterThreadModal
            slug={selectedSlug}
            slugKey={selectedThread.slugKey}
            guestId={selectedGuestId}
            guestKey={selectedThread.guestKey}
            threadTitle={`${selectedTitle} / ${selectedDisplayName}`}
            counterpartName={selectedDisplayName}
            articleHref={`/room/${encodeURIComponent(selectedSlug)}?guest=${encodeURIComponent(selectedGuestId)}`}
            articleLinkLabel="記事ページへ"
            closeHref={closeHref}
          />
        ) : null}
      </section>
    </main>
  );
}
