/** クライアントは現在オリジン、サーバーは NEXT_PUBLIC_SITE_URL を基準に絶対 URL 化 */
export function toPublicAbsoluteHref(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (typeof window !== "undefined") {
    try {
      return new URL(href, window.location.origin).href;
    } catch {
      return href;
    }
  }
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (!env) return href;
  try {
    return new URL(href, `${env}/`).href;
  } catch {
    return href;
  }
}
