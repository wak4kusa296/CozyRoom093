import { redirect } from "next/navigation";
import {
  excerptFromArticleHtml,
  getContentBySlug,
  listMagazineSummaries,
  listPublicContents
} from "@/lib/content";
import { getFirstRegisteredMagazineThumbnail, listMagazines } from "@/lib/magazines";
import { getSession } from "@/lib/auth";
import { getLetters } from "@/lib/letters";
import { formatSiteDateTime } from "@/lib/site-datetime";
import { BookshelfCarousel } from "./bookshelf-carousel";
import { ArticleBodyHtml } from "@/app/components/article-body-html";
import { HeartButton } from "@/app/components/heart-button";
import { MagazineBannerLink } from "@/app/components/magazine-banner-link";
import { LetterSection } from "./[slug]/letter-section";

/** セッション必須。未ログインは / へ */
export const dynamic = "force-dynamic";

export default async function RoomPage({
  searchParams
}: {
  searchParams: Promise<{ tag?: string | string[]; magazine?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const tagFromQuery = Array.isArray(resolvedSearchParams.tag)
    ? resolvedSearchParams.tag[0] ?? ""
    : resolvedSearchParams.tag ?? "";
  const magazineFromQuery = Array.isArray(resolvedSearchParams.magazine)
    ? resolvedSearchParams.magazine[0] ?? ""
    : resolvedSearchParams.magazine ?? "";
  if (tagFromQuery) {
    redirect(`/room/search?tag=${encodeURIComponent(tagFromQuery)}`);
  }
  if (magazineFromQuery) {
    redirect(`/room/search?magazine=${encodeURIComponent(magazineFromQuery)}`);
  }

  /* ルームトップはゲストと同じ公開記事のみ（管理者も非公開の最新はここに出さない） */
  const [items, magazines, firstRegisteredMagazineThumbnail] = await Promise.all([
    listPublicContents(),
    listMagazines(),
    getFirstRegisteredMagazineThumbnail()
  ]);
  const magazineSummaries = listMagazineSummaries(items);
  const magazineThumbnails: Record<string, string> = {};
  const magazineByName = new Map(magazines.map((m) => [m.name, m]));
  for (const mag of magazines) {
    if (mag.thumbnail) magazineThumbnails[mag.name] = mag.thumbnail;
  }
  const [latest, ...shelfItems] = items;
  const latestDetail = latest ? await getContentBySlug(latest.slug) : null;
  const latestLetters = latest ? await getLetters(latest.slug, session.guestId) : [];
  const firstShelfDetail = shelfItems[0] ? await getContentBySlug(shelfItems[0].slug) : null;
  const worksOpeningExcerpt = firstShelfDetail ? excerptFromArticleHtml(firstShelfDetail.html) : undefined;

  return (
    <main className="room">
      <section id="letters">
        {latest ? (
          <article className="latest-article">
            <div className="article-main-block">
              <div className="article-sticky-header">
                <div className="article-sticky-subtitle-block">
                  <h6 className="section-title section-title-sub room-latest-letters-heading">
                    <span className="material-symbols-outlined room-latest-letters-heading-icon" aria-hidden="true">
                      local_post_office
                    </span>
                    受信した最新の文字
                  </h6>
                </div>
                <div className="article-sticky-title-block">
                  <p className="meta">{formatSiteDateTime(latest.date)}</p>
                  <h2>{latest.title}</h2>
                </div>
              </div>
              {latestDetail ? <ArticleBodyHtml html={latestDetail.html} /> : null}
              {latest ? <HeartButton slug={latest.slug} /> : null}
            </div>
            <div className="letter-block">
              <LetterSection slug={latest.slug} initialLetters={latestLetters} />
            </div>
          </article>
        ) : (
          <article className="latest-article">
            <p>まだ公開された頁はありません。</p>
          </article>
        )}
      </section>

      <section id="works" className="works-featured">
        <h2 className="section-title">きょうまでの特集</h2>
        <BookshelfCarousel
          variant="magazine"
          magazineLayout="works-featured"
          openingExcerpt={worksOpeningExcerpt}
          items={shelfItems}
          maxItems={3}
          featuredFirst
          magazineThumbnails={magazineThumbnails}
          firstRegisteredMagazineThumbnail={firstRegisteredMagazineThumbnail}
        />
      </section>
      <section id="magazines">
        <h2 className="section-title">マガジン一覧</h2>
        {magazineSummaries.length === 0 ? (
          <p className="bookshelf-empty">まだ登録されたマガジンはありません。</p>
        ) : (
          <div className="article-magazine-banners" aria-label="マガジン一覧">
            {magazineSummaries.map((magazine) => {
              const meta = magazineByName.get(magazine.name);
              const parts = [meta?.description?.trim(), `${magazine.count}件`].filter(Boolean).join(" · ");
              return (
                <MagazineBannerLink
                  key={magazine.name}
                  magazineName={magazine.name}
                  description={parts}
                  thumbnail={meta?.thumbnail}
                />
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
