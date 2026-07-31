/**
 * 任意 URL の HTML から OG / Twitter / title を抽出（依存なしの軽量パース）
 */
import { lookup } from "dns/promises";
import { isIP } from "net";
import { request, type RequestOptions } from "http";
import { request as requestTls } from "https";

export type LinkPreviewData = {
  title: string;
  description: string;
  image: string | null;
  siteName: string | null;
};

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 600_000;
const MAX_REDIRECTS = 3;
const HTML_CONTENT_TYPES = new Set(["text/html", "application/xhtml+xml"]);

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
    const url = new URL(maybeRelative.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 2 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%", 1)[0];
  if (!normalized || normalized === "::" || normalized === "::1") return true;
  if (/^fe[89ab]:/i.test(normalized) || /^(fc|fd)[0-9a-f]{2}:/i.test(normalized)) return true;
  if (/^ff[0-9a-f]{2}:/i.test(normalized) || !/^[23][0-9a-f]{3}:/i.test(normalized)) return true;
  if (/^2001:0db8:/i.test(normalized)) return true;
  const mapped = normalized.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return mapped ? isBlockedIpv4(mapped[1]) : false;
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !isBlockedIpv4(address) : family === 6 ? !isBlockedIpv6(address) : false;
}

async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 } | null> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    host === "metadata.aws"
  ) {
    return null;
  }
  const literalFamily = isIP(host);
  if (literalFamily) return isPublicAddress(host) ? { address: host, family: literalFamily as 4 | 6 } : null;

  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) return null;
    const selected = addresses[0];
    return selected ? { address: selected.address, family: selected.family as 4 | 6 } : null;
  } catch {
    return null;
  }
}

async function validateTarget(url: URL): Promise<{ address: string; family: 4 | 6 } | null> {
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password || !url.hostname) {
    return null;
  }
  return resolvePublicAddress(url.hostname);
}

function requestHtml(
  url: URL,
  target: { address: string; family: 4 | 6 }
): Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; NobodyRoomLinkPreview/1.0)"
      },
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      timeout: FETCH_TIMEOUT_MS
    };
    const send = url.protocol === "https:" ? requestTls : request;
    const req = send(options, (res) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      res.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_HTML_BYTES) req.destroy(new Error("response_too_large"));
        else chunks.push(chunk);
      });
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.once("timeout", () => req.destroy(new Error("request_timeout")));
    req.once("error", reject);
    req.end();
  });
}

async function fetchSafeHtml(startUrl: URL): Promise<{ html: string; finalUrl: URL } | null> {
  let url = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const target = await validateTarget(url);
    if (!target) return null;
    let response: Awaited<ReturnType<typeof requestHtml>>;
    try {
      response = await requestHtml(url, target);
    } catch {
      return null;
    }
    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location;
      const nextLocation = Array.isArray(location) ? location[0] : location;
      if (!nextLocation || redirects === MAX_REDIRECTS) return null;
      try {
        url = new URL(nextLocation, url);
      } catch {
        return null;
      }
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) return null;
    const header = response.headers["content-type"];
    const contentType = (Array.isArray(header) ? header[0] : header)?.split(";", 1)[0].trim().toLowerCase();
    if (!contentType || !HTML_CONTENT_TYPES.has(contentType)) return null;
    return { html: response.body.toString("utf8"), finalUrl: url };
  }
  return null;
}

export async function fetchLinkPreview(urlString: string): Promise<LinkPreviewData | null> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;

  const response = await fetchSafeHtml(url);
  if (!response) return null;
  const { html, finalUrl } = response;

  const baseHref = finalUrl.href;

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
    finalUrl.hostname;

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
    title: title || finalUrl.hostname,
    description,
    image,
    siteName: siteName || finalUrl.hostname
  };
}
