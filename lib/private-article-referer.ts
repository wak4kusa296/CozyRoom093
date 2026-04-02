function decodeSlugSegment(segment: string): string {
  const trimmed = segment.replace(/\/$/, "");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

/**
 * 非公開記事を管理者が閲覧してよいか（Referer ベース）。
 * - Referer なし … アドレスバー直打ち・ブックマーク等とみなし true
 * - Referer が同一 `/room/{slug}` … 再読込等とみなし true
 * - それ以外（サイト内リンク・外部・別記事）… false（404）
 */
export function isPrivateArticleAccessAllowedByReferer(referer: string | null, articleSlug: string): boolean {
  if (!referer) return true;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return true;
  }
  const path = url.pathname.replace(/\/$/, "") || "/";
  const m = path.match(/^\/room\/(.+)$/);
  if (!m) return false;
  const refSlug = decodeSlugSegment(m[1]);
  return refSlug === articleSlug;
}
