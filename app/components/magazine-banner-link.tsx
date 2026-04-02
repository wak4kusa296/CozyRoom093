import Link from "next/link";

type MagazineBannerLinkProps = {
  magazineName: string;
  /** 省略時は説明行を出さない */
  description?: string | null;
  thumbnail?: string | null;
};

/** 所属マガジン帯（記事下・トップページ周りなど共通） */
export function MagazineBannerLink({
  magazineName,
  description,
  thumbnail
}: MagazineBannerLinkProps) {
  const href = `/room/magazine/${encodeURIComponent(magazineName)}`;
  const desc = description?.trim() ?? "";
  const showDesc = desc.length > 0;

  return (
    <Link href={href} className="article-magazine-banner">
      <span className="article-magazine-banner-content">
        <span className="article-magazine-banner-body">
          <span className="article-magazine-banner-label">マガジン</span>
          <span className="article-magazine-banner-title">{magazineName}</span>
          {showDesc ? <span className="article-magazine-banner-desc">{desc}</span> : null}
        </span>
        <span className="material-symbols-outlined article-magazine-banner-chevron" aria-hidden="true">
          chevron_right
        </span>
      </span>
      {thumbnail ? (
        <span className="article-magazine-banner-media" aria-hidden="true">
          <img
            className="article-magazine-banner-thumb-img"
            src={`/thumbnails/${thumbnail}`}
            alt=""
            width={320}
            height={180}
            decoding="async"
          />
        </span>
      ) : (
        <span className="article-magazine-banner-media article-magazine-banner-fallback" aria-hidden="true">
          <span className="material-symbols-outlined">collections_bookmark</span>
        </span>
      )}
    </Link>
  );
}
