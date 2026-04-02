/**
 * 任意 URL の HTML から OG / Twitter / title を抽出（依存なしの軽量パース）
 */

export type LinkPreviewData = {
  title: string;
  description: string;
  image: string | null;
  siteName: string | null;
};

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_CHARS = 600_000;

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
}

function extractMetaContent(html: string, attr: "property" | "name", key: string): string | null {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rePropFirst = new RegExp(
    `<meta[^>]+${attr}=["']${esc}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i"
  );
  const reContentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${esc}["'][^>]*>`,
    "i"
  );
  const m = html.match(rePropFirst) || html.match(reContentFirst);
  if (!m?.[1]) return null;
  const v = m[1].trim();
  return v ? decodeHtmlEntities(v) : null;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!m?.[1]) return "";
  return decodeHtmlEntities(m[1].trim());
}

function toAbsoluteUrl(maybeRelative: string, base: string): string | null {
  try {
    return new URL(maybeRelative.trim(), base).href;
  } catch {
    return null;
  }
}

function isBlockedHostname(hostname: string): boolean {
  /* 本番での簡易 SSRF 対策。開発時は同一オリジンの OG 取得に localhost が必要 */
  if (process.env.NODE_ENV !== "production") return false;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;
  return false;
}

export async function fetchLinkPreview(urlString: string): Promise<LinkPreviewData | null> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (isBlockedHostname(url.hostname)) {
    return null;
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url.href, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; NobodyRoomLinkPreview/1.0; +https://github.com/) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const text = await res.text();
    html = text.length > MAX_HTML_CHARS ? text.slice(0, MAX_HTML_CHARS) : text;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }

  const baseHref = url.href;

  let image =
    extractMetaContent(html, "property", "og:image") ||
    extractMetaContent(html, "property", "twitter:image") ||
    extractMetaContent(html, "name", "twitter:image") ||
    extractMetaContent(html, "name", "twitter:image:src");
  if (image) {
    const abs = toAbsoluteUrl(image, baseHref);
    image = abs;
  } else {
    image = null;
  }

  const title =
    extractMetaContent(html, "property", "og:title") ||
    extractMetaContent(html, "name", "twitter:title") ||
    extractTitle(html) ||
    url.hostname;

  const description =
    extractMetaContent(html, "property", "og:description") ||
    extractMetaContent(html, "name", "twitter:description") ||
    extractMetaContent(html, "name", "description") ||
    "";

  const siteName =
    extractMetaContent(html, "property", "og:site_name") ||
    extractMetaContent(html, "name", "application-name") ||
    null;

  return {
    title: title || url.hostname,
    description,
    image,
    siteName: siteName || url.hostname
  };
}
