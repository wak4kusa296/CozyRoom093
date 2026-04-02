import { readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

export type { ContentDetail, ContentMeta, ContentType } from "./content-shared";
export { resolveContentThumbnail } from "./content-shared";

import type { ContentDetail, ContentMeta } from "./content-shared";

const CONTENT_DIR = path.join(process.cwd(), "content");
const HASHTAG_PATTERN = /(^|[\s　])#([^\s#]+)/g;
const INLINE_HASHTAG_PATTERN = /#([^\s#<]+)/g;

export function normalizeSlugParam(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function parseTagsFromFrontmatter(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,、]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseMagazinesFromFrontmatter(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    return value
      .split(/[\s,、]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractHashtags(content: string) {
  const found = new Set<string>();
  for (const match of content.matchAll(HASHTAG_PATTERN)) {
    const tag = match[2]?.trim();
    if (!tag) continue;
    found.add(tag);
  }
  return Array.from(found);
}

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
    )
  );
}

function normalizeMagazines(magazines: string[]) {
  return Array.from(new Set(magazines.map((magazine) => magazine.trim()).filter(Boolean)));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

/** 本文 HTML の先頭段落からプレーンテキスト抜粋（ルーム #works 特集など） */
export function excerptFromArticleHtml(html: string, maxLen = 220): string {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match) return "";
  const text = stripHtmlTags(match[1]).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

function isHashtagOnlyLine(text: string) {
  const hashtags = [...text.matchAll(INLINE_HASHTAG_PATTERN)].map((match) => match[1]);
  if (hashtags.length === 0) return false;

  const remainingText = text.replace(INLINE_HASHTAG_PATTERN, "").replace(/[\s　]/g, "");
  return remainingText.length === 0;
}

function convertHashtagParagraphs(html: string) {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (full, innerHtml: string) => {
    const lines = innerHtml.split(/<br\s*\/?>|\r?\n/gi);
    const normalLines: string[] = [];
    const hashtagSet = new Set<string>();

    for (const line of lines) {
      const plainText = stripHtmlTags(line).trim();
      if (!plainText) {
        continue;
      }

      if (isHashtagOnlyLine(plainText)) {
        for (const match of plainText.matchAll(INLINE_HASHTAG_PATTERN)) {
          const tag = match[1]?.trim();
          if (tag) hashtagSet.add(tag);
        }
        continue;
      }

      normalLines.push(line.trim());
    }

    if (hashtagSet.size === 0) {
      return full;
    }

    const tagMarkup = Array.from(hashtagSet)
      .map((tag) => `<a class="article-tag" href="/room/search?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`)
      .join("");
    const tagParagraph = `<p class="article-tags">${tagMarkup}</p>`;

    if (normalLines.length === 0) {
      return tagParagraph;
    }

    return `<p>${normalLines.join("<br>")}</p>${tagParagraph}`;
  });
}

function parseIsoDateString(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** フロントマターの date → published_at → ファイル更新時刻 の順で解決（未設定の 1970 表記を防ぐ） */
function resolveContentDateIso(data: Record<string, unknown>, fileMtimeIso?: string): string {
  const fromDate = parseIsoDateString(data.date);
  if (fromDate) return fromDate;
  const fromPublished = parseIsoDateString(data.published_at);
  if (fromPublished) return fromPublished;
  const fromMtime = parseIsoDateString(fileMtimeIso);
  if (fromMtime) return fromMtime;
  return "1970-01-01T00:00:00.000Z";
}

/** マークダウン本文をざっくりプレーン化し、タイトル・タグ・マガジン名以外の検索に使う */
function markdownToSearchPlain(markdown: string): string {
  let s = markdown;
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/^\s*#{1,6}\s+/gm, " ");
  s = s.replace(/^\s*[-*+]\s+/gm, " ");
  s = s.replace(/^\s*\d+\.\s+/gm, " ");
  s = s.replace(/[*_~`>#|]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function normalizeMeta(slug: string, data: Record<string, unknown>, content = "", updatedAt?: string): ContentMeta {
  const frontmatterTags = parseTagsFromFrontmatter(data.tags);
  const inlineTags = extractHashtags(content);
  const frontmatterMagazines = parseMagazinesFromFrontmatter(data.magazines ?? data.magazine);

  const plain = content.trim() ? markdownToSearchPlain(content) : "";

  return {
    slug,
    title: String(data.title ?? slug),
    date: resolveContentDateIso(data, updatedAt),
    published_at: data.published_at ? String(data.published_at) : undefined,
    updated_at: updatedAt,
    status: data.status === "public" ? "public" : "private",
    type: data.type === "illustration" || data.type === "video" ? data.type : "article",
    magazines: normalizeMagazines(frontmatterMagazines),
    tags: normalizeTags([...frontmatterTags, ...inlineTags]),
    thumbnail: typeof data.thumbnail === "string" && data.thumbnail.trim() ? data.thumbnail.trim() : undefined,
    ...(plain ? { searchText: plain } : {})
  };
}

export async function listContents() {
  const files = await readdir(CONTENT_DIR);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  const list = await Promise.all(
    markdownFiles.map(async (file) => {
      const slug = file.replace(/\.md$/, "");
      const filePath = path.join(CONTENT_DIR, file);
      const [raw, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
      const parsed = matter(raw);
      return normalizeMeta(slug, parsed.data as Record<string, unknown>, parsed.content, info.mtime.toISOString());
    })
  );

  return list.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function listPublicContents() {
  const items = await listContents();
  return items.filter((item) => item.status === "public");
}

export async function getContentBySlug(slug: string) {
  const normalizedSlug = normalizeSlugParam(slug);
  const candidates = Array.from(new Set([normalizedSlug, slug]));

  let resolvedSlug: string | null = null;
  let resolvedPath: string | null = null;
  let raw: string | null = null;
  for (const candidate of candidates) {
    try {
      const filePath = path.join(CONTENT_DIR, `${candidate}.md`);
      raw = await readFile(filePath, "utf8");
      resolvedSlug = candidate;
      resolvedPath = filePath;
      break;
    } catch {
      // Try next candidate.
    }
  }

  if (!raw || !resolvedSlug) {
    throw new Error(`Content not found: ${slug}`);
  }

  const info = await stat(resolvedPath!);
  const parsed = matter(raw);
  const rawHtml = String(await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(parsed.content));
  const html = convertHashtagParagraphs(rawHtml);

  return {
    ...normalizeMeta(resolvedSlug, parsed.data as Record<string, unknown>, parsed.content, info.mtime.toISOString()),
    html
  } satisfies ContentDetail;
}

export async function setContentStatus(slug: string, status: "public" | "private") {
  const normalizedSlug = normalizeSlugParam(slug);
  const filePath = path.join(CONTENT_DIR, `${normalizedSlug}.md`);
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const previousStatus = parsed.data.status === "public" ? "public" : "private";
  const currentPublishedAt = parsed.data.published_at ? String(parsed.data.published_at) : undefined;
  const nextData: Record<string, unknown> = {
    ...parsed.data,
    status
  };

  // Keep the first published timestamp permanently once it exists.
  const nextPublishedAt = status === "public" ? (currentPublishedAt ?? new Date().toISOString()) : currentPublishedAt;
  if (nextPublishedAt) {
    nextData.published_at = nextPublishedAt;
  } else {
    delete nextData.published_at;
  }

  const nextRaw = matter.stringify(parsed.content, nextData);
  await writeFile(filePath, nextRaw, "utf8");

  const becamePublic = status === "public" && previousStatus !== "public";
  if (becamePublic) {
    const { pingAllRoomNotificationSubscribers } = await import("@/lib/notification-push");
    const { markContentNotificationReadAllGuests } = await import("@/lib/guest-notification-reads");
    // 初回公開のみルーム通知ベル・SSE を更新。再公開（published_at が既にある）は未読を作らない。
    const isRepublish = Boolean(currentPublishedAt);
    if (isRepublish) {
      await markContentNotificationReadAllGuests(normalizedSlug);
    }
    pingAllRoomNotificationSubscribers();
  }
}

export async function setContentTitle(slug: string, title: string) {
  const normalizedSlug = normalizeSlugParam(slug);
  const filePath = path.join(CONTENT_DIR, `${normalizedSlug}.md`);
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const nextData = {
    ...parsed.data,
    title: trimmedTitle
  };
  const nextRaw = matter.stringify(parsed.content, nextData);
  await writeFile(filePath, nextRaw, "utf8");
}

export async function setContentMagazines(slug: string, magazines: string[]) {
  const normalizedSlug = normalizeSlugParam(slug);
  const filePath = path.join(CONTENT_DIR, `${normalizedSlug}.md`);
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const normalizedMagazines = normalizeMagazines(magazines);
  const nextData: Record<string, unknown> = {
    ...parsed.data
  };

  if (normalizedMagazines.length > 0) {
    nextData.magazines = normalizedMagazines;
  } else {
    delete nextData.magazines;
  }
  delete nextData.magazine;

  const nextRaw = matter.stringify(parsed.content, nextData);
  await writeFile(filePath, nextRaw, "utf8");
}

export async function setContentThumbnail(slug: string, thumbnail: string) {
  const normalizedSlug = normalizeSlugParam(slug);
  const filePath = path.join(CONTENT_DIR, `${normalizedSlug}.md`);
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const nextData: Record<string, unknown> = { ...parsed.data };

  if (thumbnail) {
    nextData.thumbnail = thumbnail;
  } else {
    delete nextData.thumbnail;
  }

  const nextRaw = matter.stringify(parsed.content, nextData);
  await writeFile(filePath, nextRaw, "utf8");
}

async function rewriteContentFileMagazines(
  filePath: string,
  update: (currentMagazines: string[]) => string[]
) {
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const currentMagazines = parseMagazinesFromFrontmatter(
    (parsed.data as Record<string, unknown>).magazines ?? (parsed.data as Record<string, unknown>).magazine
  );
  const nextMagazines = normalizeMagazines(update(currentMagazines));
  const nextData: Record<string, unknown> = {
    ...parsed.data
  };

  if (nextMagazines.length > 0) {
    nextData.magazines = nextMagazines;
  } else {
    delete nextData.magazines;
  }
  delete nextData.magazine;

  const nextRaw = matter.stringify(parsed.content, nextData);
  if (nextRaw !== raw) {
    await writeFile(filePath, nextRaw, "utf8");
  }
}

export async function renameMagazineInAllContents(fromName: string, toName: string) {
  const normalizedFrom = fromName.trim();
  const normalizedTo = toName.trim();
  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) return;

  const files = await readdir(CONTENT_DIR);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));
  await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(CONTENT_DIR, file);
      await rewriteContentFileMagazines(filePath, (current) =>
        current.map((magazine) => (magazine === normalizedFrom ? normalizedTo : magazine))
      );
    })
  );
}

export async function removeMagazineFromAllContents(name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) return;

  const files = await readdir(CONTENT_DIR);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));
  await Promise.all(
    markdownFiles.map(async (file) => {
      const filePath = path.join(CONTENT_DIR, file);
      await rewriteContentFileMagazines(filePath, (current) => current.filter((magazine) => magazine !== normalizedName));
    })
  );
}

export function listMagazineSummaries(items: ContentMeta[]) {
  const map = new Map<string, { name: string; count: number; latestDate: string }>();

  for (const item of items) {
    for (const magazine of item.magazines) {
      const current = map.get(magazine);
      if (!current) {
        map.set(magazine, { name: magazine, count: 1, latestDate: item.date });
        continue;
      }

      current.count += 1;
      if (item.date > current.latestDate) {
        current.latestDate = item.date;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.latestDate === b.latestDate) return a.name.localeCompare(b.name, "ja");
    return a.latestDate < b.latestDate ? 1 : -1;
  });
}

export function getVisibilityLabel(item: ContentMeta) {
  if (item.status === "private") return "ひそやかに公開中";
  if (!item.published_at) return "公開中";

  const now = Date.now();
  const target = new Date(item.published_at).getTime();
  return target > now ? "公開予定" : "公開中";
}
