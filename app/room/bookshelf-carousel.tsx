import Link from "next/link";
import { resolveContentThumbnail, type ContentMeta } from "@/lib/content-shared";
import { formatSiteDateTime } from "@/lib/site-datetime";

function normalizeTagKeyword(value: string) {
  return value.trim().replace(/^#/, "").toLowerCase();
}

function normalizeMagazineKeyword(value: string) {
  return value.trim().toLowerCase();
}

export function BookshelfCarousel({
  items,
  initialTagQuery = "",
  initialMagazineQuery = "",
  maxItems,
  featuredFirst = false,
  magazineThumbnails = {},
  /** 記事サムネなし・所属マガジンにもサムネなしのとき、登録順先頭マガジンのサムネ */
  firstRegisteredMagazineThumbnail,
  variant = "default",
  magazineLayout = "strip",
  openingExcerpt,
  emptyFilterMessage = "該当するタグの作品はまだありません。"
}: {
  items: ContentMeta[];
  initialTagQuery?: string;
  initialMagazineQuery?: string;
  maxItems?: number;
  featuredFirst?: boolean;
  magazineThumbnails?: Record<string, string>;
  firstRegisteredMagazineThumbnail?: string;
  /** マガジンページ: 1カラム・サムネ＋文字の横並び（帯） */
  variant?: "default" | "magazine";
  /**
   * variant=magazine のとき:
   * - strip … マガジン一覧など（帯1カラム）
   * - works-featured … ルーム #works のみ。1件目は全文幅＋冒頭抜粋、2〜3件目は2カラムカード
   * - search-grid … /room/search 用。すべてグリッドカード
   */
  magazineLayout?: "strip" | "works-featured" | "search-grid";
  /** filteredItems が空のとき（items はあるが） */
  emptyFilterMessage?: string;
  /** magazineLayout=works-featured のとき1件目の下に表示する冒頭本文 */
  openingExcerpt?: string;
}) {
  const normalizedTagQuery = normalizeTagKeyword(initialTagQuery);
  const normalizedMagazineQuery = normalizeMagazineKeyword(initialMagazineQuery);
  const filteredItems = items.filter((item) => {
    const matchedTag = normalizedTagQuery
      ? item.tags.some((tag) => tag.toLowerCase().includes(normalizedTagQuery))
      : true;
    const matchedMagazine = normalizedMagazineQuery
      ? item.magazines.some((magazine) => magazine.toLowerCase().includes(normalizedMagazineQuery))
      : true;
    return matchedTag && matchedMagazine;
  });
  const displayItems = typeof maxItems === "number" ? filteredItems.slice(0, maxItems) : filteredItems;

  if (items.length === 0) {
    return <p className="bookshelf-empty">まだ本棚に並ぶ頁はありません。</p>;
  }

  const wrapClass =
    variant === "magazine"
      ? "bookshelf-search-wrap bookshelf-search-wrap--magazine"
      : "bookshelf-search-wrap";
  const worksFeaturedLayout = variant === "magazine" && magazineLayout === "works-featured";
  const worksSearchGrid = variant === "magazine" && magazineLayout === "search-grid";
  const magazineStrip = variant === "magazine" && magazineLayout === "strip";
  const trackClass = [
    "bookshelf-track",
    variant === "magazine" ? "bookshelf-track--magazine" : null,
    worksFeaturedLayout || worksSearchGrid ? "bookshelf-track--magazine-works-featured" : null
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapClass}>
      {displayItems.length === 0 ? (
        <p className="bookshelf-empty">{emptyFilterMessage}</p>
      ) : (
        <div className={trackClass}>
          {displayItems.map((item, index) => (
            <Link
              key={item.slug}
              href={`/room/${item.slug}`}
              draggable={false}
              className={[
                "bookshelf-item",
                "bookshelf-item-main-link",
                featuredFirst && index === 0 && !worksSearchGrid ? "bookshelf-item-featured" : "",
                magazineStrip ? "bookshelf-item--magazine-strip" : "",
                worksFeaturedLayout && index === 0 ? "bookshelf-item--works-lead" : "",
                worksFeaturedLayout && index > 0 ? "bookshelf-item--works-grid-card" : "",
                worksSearchGrid ? "bookshelf-item--works-grid-card" : ""
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="bookshelf-thumb" aria-hidden="true">
                {(() => {
                  const thumbFile = resolveContentThumbnail(
                    item,
                    magazineThumbnails,
                    firstRegisteredMagazineThumbnail
                  );
                  return thumbFile
                    ? <img src={`/thumbnails/${thumbFile}`} alt="" className="bookshelf-thumb-img" />
                    : <span className="bookshelf-thumb-label">Preview</span>;
                })()}
              </div>
              <div className="bookshelf-item-body">
                <p>{formatSiteDateTime(item.date)}</p>
                <h3>{item.title}</h3>
                {worksFeaturedLayout && index === 0 && openingExcerpt ? (
                  <p className="bookshelf-item-excerpt">{openingExcerpt}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
