import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { assertContentMarkdownWritable, isPostgresMarkdownStore } from "@/lib/content-fs-env";
import {
  dbDeleteRawMarkdown,
  dbGetRawMarkdown,
  dbIsSlugDeleted,
  dbListContentSlugs,
  dbListDeletedSlugs,
  dbRecordDeletedSlug,
  dbUpsertRawMarkdown
} from "@/lib/content-markdown-db";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

export type { ContentDetail, ContentMeta, ContentType } from "./content-shared";
export { resolveContentThumbnail } from "./content-shared";

import type { ContentDetail, ContentMeta } from "./content-shared";

const CONTENT_DIR = path.join(process.cwd(), "content");
const HASHTAG_PATTERN = /(^|[\s　])#([^\s#]+)/g;
const INLINE_HASHTAG_PATTERN = /#([^\s#<]+)/g;

async function listSlugsFromDisk(): Promise<string[]> {
  try {
    const files = await readdir(CONTENT_DIR);
    return files.filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}

async function listAllSlugsMerged(): Promise<string[]> {
  const disk = await listSlugsFromDisk();
  if (!isPostgresMarkdownStore()) {
    return disk.sort((a, b) => a.localeCompare(b, "ja"));
  }
  const [dbSlugs, deleted] = await Promise.all([dbListContentSlugs(), dbListDeletedSlugs()]);
  const diskVisible = disk.filter((s) => !deleted.has(s));
  const set = new Set([...diskVisible, ...dbSlugs]);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}

async function loadRawMarkdown(slug: string): Promise<{ raw: string; updatedAt: string } | null> {
  const normalized = normalizeSlugParam(slug);
  if (isPostgresMarkdownStore()) {
    if (await dbIsSlugDeleted(normalized)) return null;
    const fromDb = await dbGetRawMarkdown(normalized);
    if (fromDb) return fromDb;
  }
  const filePath = path.join(CONTENT_DIR, `${normalized}.md`);
  try {
    const [raw, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
    return { raw, updatedAt: info.mtime.toISOString() };
  } catch {
    return null;
  }
}

async function persistMarkdown(slug: string, raw: string): Promise<void> {
  const normalized = normalizeSlugParam(slug);
  if (isPostgresMarkdownStore()) {
    await dbUpsertRawMarkdown(normalized, raw);
    return;
  }
  await mkdir(CONTENT_DIR, { recursive: true });
  const filePath = path.join(CONTENT_DIR, `${normalized}.md`);
  await writeFile(filePath, raw, "utf8");
}

async function deleteMarkdownStorage(slug: string): Promise<void> {
  const normalized = normalizeSlugParam(slug);
  if (isPostgresMarkdownStore()) {
    await dbDeleteRawMarkdown(normalized);
    await dbRecordDeletedSlug(normalized);
  }
  const filePath = path.join(CONTENT_DIR, `${normalized}.md`);
  await unlink(filePath).catch(() => undefined);
}

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
  const slugs = await listAllSlugsMerged();
  const list = await Promise.all(
    slugs.map(async (slug) => {
      const loaded = await loadRawMarkdown(slug);
      if (!loaded) return null;
      const parsed = matter(loaded.raw);
      return normalizeMeta(slug, parsed.data as Record<string, unknown>, parsed.content, loaded.updatedAt);
    })
  );

  return list.filter((x): x is ContentMeta => x != null).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function listPublicContents() {
  const items = await listContents();
  return items.filter((item) => item.status === "public");
}

export async function getContentBySlug(slug: string) {
  const normalizedSlug = normalizeSlugParam(slug);
  const candidates = Array.from(new Set([normalizedSlug, slug]));

  let resolvedSlug: string | null = null;
  let loaded: { raw: string; updatedAt: string } | null = null;
  for (const candidate of candidates) {
    const result = await loadRawMarkdown(candidate);
    if (result) {
      resolvedSlug = normalizeSlugParam(candidate);
      loaded = result;
      break;
    }
  }

  if (!loaded || !resolvedSlug) {
    throw new Error(`Content not found: ${slug}`);
  }

  const parsed = matter(loaded.raw);
  const rawHtml = String(await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(parsed.content));
  const html = convertHashtagParagraphs(rawHtml);

  return {
    ...normalizeMeta(resolvedSlug, parsed.data as Record<string, unknown>, parsed.content, loaded.updatedAt),
    html
  } satisfies ContentDetail;
}

export async function setContentStatus(slug: string, status: "public" | "private") {
  assertContentMarkdownWritable();
  const normalizedSlug = normalizeSlugParam(slug);
  const loaded = await loadRawMarkdown(normalizedSlug);
  if (!loaded) throw new Error(`Content not found: ${slug}`);
  const raw = loaded.raw;
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
  await persistMarkdown(normalizedSlug, nextRaw);

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
  assertContentMarkdownWritable();
  const normalizedSlug = normalizeSlugParam(slug);
  const loaded = await loadRawMarkdown(normalizedSlug);
  if (!loaded) throw new Error(`Content not found: ${slug}`);
  const raw = loaded.raw;
  const parsed = matter(raw);
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const nextData = {
    ...parsed.data,
    title: trimmedTitle
  };
  const nextRaw = matter.stringify(parsed.content, nextData);
  await persistMarkdown(normalizedSlug, nextRaw);
}

export async function setContentMagazines(slug: string, magazines: string[]) {
  assertContentMarkdownWritable();
  const normalizedSlug = normalizeSlugParam(slug);
  const loaded = await loadRawMarkdown(normalizedSlug);
  if (!loaded) throw new Error(`Content not found: ${slug}`);
  const raw = loaded.raw;
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
  await persistMarkdown(normalizedSlug, nextRaw);
}

export async function setContentThumbnail(slug: string, thumbnail: string) {
  assertContentMarkdownWritable();
  const normalizedSlug = normalizeSlugParam(slug);
  const loaded = await loadRawMarkdown(normalizedSlug);
  if (!loaded) throw new Error(`Content not found: ${slug}`);
  const raw = loaded.raw;
  const parsed = matter(raw);
  const nextData: Record<string, unknown> = { ...parsed.data };

  if (thumbnail) {
    nextData.thumbnail = thumbnail;
  } else {
    delete nextData.thumbnail;
  }

  const nextRaw = matter.stringify(parsed.content, nextData);
  await persistMarkdown(normalizedSlug, nextRaw);
}

async function rewriteContentMagazinesForSlug(
  slug: string,
  update: (currentMagazines: string[]) => string[]
) {
  assertContentMarkdownWritable();
  const normalizedSlug = normalizeSlugParam(slug);
  const loaded = await loadRawMarkdown(normalizedSlug);
  if (!loaded) return;
  const raw = loaded.raw;
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
    await persistMarkdown(normalizedSlug, nextRaw);
  }
}

export async function renameMagazineInAllContents(fromName: string, toName: string) {
  assertContentMarkdownWritable();
  const normalizedFrom = fromName.trim();
  const normalizedTo = toName.trim();
  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) return;

  const slugs = await listAllSlugsMerged();
  await Promise.all(
    slugs.map(async (slug) => {
      await rewriteContentMagazinesForSlug(slug, (current) =>
        current.map((magazine) => (magazine === normalizedFrom ? normalizedTo : magazine))
      );
    })
  );
}

export async function removeMagazineFromAllContents(name: string) {
  assertContentMarkdownWritable();
  const normalizedName = name.trim();
  if (!normalizedName) return;

  const slugs = await listAllSlugsMerged();
  await Promise.all(
    slugs.map(async (slug) => {
      await rewriteContentMagazinesForSlug(slug, (current) =>
        current.filter((magazine) => magazine !== normalizedName)
      );
    })
  );
}

function normalizeFileStem(value: string) {
  return value
    .replace(/\.md$/i, "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function stemExistsInStorage(stem: string): Promise<boolean> {
  if (isPostgresMarkdownStore()) {
    const row = await dbGetRawMarkdown(stem);
    if (row) return true;
  }
  try {
    await access(path.join(CONTENT_DIR, `${stem}.md`));
    return true;
  } catch {
    return false;
  }
}

export async function resolveUniqueMarkdownStem(originalFileName: string): Promise<string> {
  const safeStem = normalizeFileStem(originalFileName.replace(/\.md$/i, "")) || `article-${Date.now()}`;
  let candidate = safeStem;
  let suffix = 1;
  while (await stemExistsInStorage(candidate)) {
    candidate = `${safeStem}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/** 管理画面からの新規 .md アップロード（Postgres またはローカル content/） */
export async function createMarkdownUpload(originalFileName: string, bytes: Buffer): Promise<string> {
  assertContentMarkdownWritable();
  const slug = await resolveUniqueMarkdownStem(originalFileName);
  await persistMarkdown(slug, bytes.toString("utf8"));
  return slug;
}

export async function replaceMarkdownFileContent(slug: string, bytes: Buffer): Promise<void> {
  assertContentMarkdownWritable();
  const normalizedSlug = normalizeSlugParam(slug);
  await persistMarkdown(normalizedSlug, bytes.toString("utf8"));
}

export async function deleteStoredMarkdown(slug: string): Promise<void> {
  assertContentMarkdownWritable();
  await deleteMarkdownStorage(slug);
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
