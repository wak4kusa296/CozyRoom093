/** Server-side public origin, configured once for metadata, redirects, and mail links. */
export function getPublicSiteUrl(fallback?: string): string | undefined {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!value) return fallback;
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

/** クライアントは現在オリジン、サーバーは configured public origin を基準に絶対 URL 化 */
export function toPublicAbsoluteHref(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (typeof window !== "undefined") {
    try {
      return new URL(href, window.location.origin).href;
    } catch {
      return href;
    }
  }
  const env = getPublicSiteUrl();
  if (!env) return href;
  try {
    return new URL(href, `${env}/`).href;
  } catch {
    return href;
  }
}
