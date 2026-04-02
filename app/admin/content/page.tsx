import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { assertContentMarkdownWritable, isContentMarkdownPersistable } from "@/lib/content-fs-env";
import {
  createMarkdownUpload,
  deleteStoredMarkdown,
  listContents,
  replaceMarkdownFileContent,
  setContentMagazines,
  setContentStatus,
  setContentThumbnail,
  setContentTitle
} from "@/lib/content";
import { listHeartSummaries } from "@/lib/hearts";
import { listMagazines } from "@/lib/magazines";
import { getMagazineContentOrders, setMagazineContentOrder } from "@/lib/magazine-content-orders";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ContentUploadModal } from "@/app/admin/content/content-upload-modal";
import { redirect } from "next/navigation";
import { ContentDetailModal } from "@/app/admin/content/content-detail-modal";
import { listLetterThreads, normalizeThreadKey } from "@/lib/letters";
import { formatSiteDateTime, formatSiteDateTimeWithSeconds } from "@/lib/site-datetime";

function formatMdFileName(slug: string) {
  return slug.endsWith(".md") ? slug : `${slug}.md`;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return formatSiteDateTimeWithSeconds(value);
}

function getPublishedDisplay(status: "public" | "private", publishedAt?: string) {
  if (status !== "public") return "未公開";
  if (!publishedAt) return "公開中";
  return formatSiteDateTime(publishedAt);
}

async function uploadContentAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  assertContentMarkdownWritable();
  const file = formData.get("contentFile");
  if (!(file instanceof File) || file.size === 0) return;
  if (!file.name.toLowerCase().endsWith(".md")) return;

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadedSlug = await createMarkdownUpload(file.name, bytes);

  revalidatePath("/admin/content");
  revalidatePath("/room");
  revalidatePath("/room/search");
  redirect(`/admin/content/setup/${encodeURIComponent(uploadedSlug)}`);
}

async function toggleContentStatusAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const slug = String(formData.get("slug") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  if (!slug) return;
  if (nextStatus !== "public" && nextStatus !== "private") return;

  await setContentStatus(slug, nextStatus);
  revalidatePath("/admin/content");
  revalidatePath("/room");
  revalidatePath("/room/search");
  revalidatePath(`/room/${encodeURIComponent(slug)}`);
}

async function updateContentMagazinesAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const slug = String(formData.get("slug") ?? "");
  if (!slug) return;

  const selected = formData
    .getAll("magazines")
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  await setContentMagazines(slug, selected);
  revalidatePath("/admin/content");
  revalidatePath("/admin/magazines");
  revalidatePath("/room");
  revalidatePath("/room/search");
  revalidatePath(`/room/${encodeURIComponent(slug)}`);
}

async function deleteContentAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  assertContentMarkdownWritable();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return;

  const normalizedSlug = slug.endsWith(".md") ? slug.replace(/\.md$/i, "") : slug;
  const [items, orders] = await Promise.all([listContents(), getMagazineContentOrders()]);
  const target = items.find((item) => item.slug === normalizedSlug);
  if (target) {
    await Promise.all(
      target.magazines.map(async (magazineName) => {
        const nextOrder = (orders[magazineName] ?? []).filter((itemSlug) => itemSlug !== normalizedSlug);
        await setMagazineContentOrder(magazineName, nextOrder);
      })
    );
  }
  await deleteStoredMarkdown(normalizedSlug);

  revalidatePath("/admin/content");
  revalidatePath("/room");
  revalidatePath("/room/search");
  revalidatePath(`/room/${encodeURIComponent(normalizedSlug)}`);
}

async function replaceContentFileAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  assertContentMarkdownWritable();
  const slug = String(formData.get("slug") ?? "").trim();
  const file = formData.get("contentFile");
  if (!slug) return;
  if (!(file instanceof File) || file.size === 0) return;
  if (!file.name.toLowerCase().endsWith(".md")) return;

  const normalizedSlug = slug.endsWith(".md") ? slug.replace(/\.md$/i, "") : slug;
  const bytes = Buffer.from(await file.arrayBuffer());
  await replaceMarkdownFileContent(normalizedSlug, bytes);

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/setup/${encodeURIComponent(normalizedSlug)}`);
  revalidatePath("/room");
  revalidatePath("/room/search");
  revalidatePath(`/room/${encodeURIComponent(normalizedSlug)}`);
}

async function updateContentThumbnailAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const slug = String(formData.get("slug") ?? "").trim();
  const thumbnail = String(formData.get("thumbnail") ?? "");
  if (!slug) return;

  await setContentThumbnail(slug, thumbnail);

  revalidatePath("/admin/content");
  revalidatePath("/room");
  revalidatePath("/room/search");
  revalidatePath(`/room/${encodeURIComponent(slug)}`);
}

async function updateContentTitleAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "");
  if (!slug) return;

  await setContentTitle(slug, title);

  revalidatePath("/admin/content");
  revalidatePath("/room");
  revalidatePath("/room/search");
  revalidatePath(`/room/${encodeURIComponent(slug)}`);
  revalidatePath(`/admin/content/setup/${encodeURIComponent(slug)}`);
}

export default async function AdminContentPage() {
  await requireAdminSession();
  const [items, heartRows, magazines, threads] = await Promise.all([
    listContents(),
    listHeartSummaries(),
    listMagazines(),
    listLetterThreads()
  ]);
  const heartsBySlug = new Map(heartRows.map((row) => [row.slug, row.total]));
  const letterGuestsBySlugKey = new Map<string, Set<string>>();
  for (const thread of threads) {
    if (!thread.slugKey || !thread.guestKey) continue;
    const current = letterGuestsBySlugKey.get(thread.slugKey) ?? new Set<string>();
    current.add(thread.guestKey);
    letterGuestsBySlugKey.set(thread.slugKey, current);
  }
  const allMagazineOptions = Array.from(
    new Set([...magazines.map((item) => item.name), ...items.flatMap((item) => item.magazines)])
  ).sort((a, b) => a.localeCompare(b, "ja"));
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card">
        <div className="admin-page-header">
          <h1>記事管理</h1>
          <p className="lead">各記事の公開状態、マガジンへの登録、反応数、Markdown を確認・更新できます。</p>
        </div>
        {!isContentMarkdownPersistable() ? (
          <p className="message" role="status">
            記事の保存先がありません。Vercel 本番では環境変数{" "}
            <code>CONTENT_MARKDOWN_STORE=postgres</code>（DB マイグレーション 005 適用済み）を設定するか、リポジトリの{" "}
            <code>content/</code> を Git からデプロイするか、ディスク書き込み可能なサーバーでホストしてください。
          </p>
        ) : null}
        <AdminNav />
        <ContentUploadModal action={uploadContentAction} />
        {magazines.length === 0 ? (
          <p className="meta">
            マガジンが未登録です。先に<Link href="/admin/magazines">マガジン管理</Link>で追加してください。
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="meta">登録された記事はありません。</p>
        ) : (
          <div className="admin-table-wrap admin-content-table-wrap">
            <table className="admin-table admin-content-table">
              <thead>
                <tr>
                  <th>記事</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isPublic = item.status === "public";
                  return (
                    <tr key={item.slug} className={isPublic ? undefined : "admin-row-inactive"}>
                      <td data-label="タイトル">
                        <ContentDetailModal
                          item={item}
                          allMagazineOptions={allMagazineOptions}
                          mdFileName={formatMdFileName(item.slug)}
                          publishedDisplay={getPublishedDisplay(item.status, item.published_at)}
                          updatedDisplay={formatDateTime(item.updated_at)}
                          issuedUrl={siteUrl ? `${siteUrl}/room/${item.slug}` : `/room/${item.slug}`}
                          heartTotal={heartsBySlug.get(item.slug) ?? 0}
                          letterGuestCount={letterGuestsBySlugKey.get(normalizeThreadKey(item.slug))?.size ?? 0}
                          lettersUrl={`/admin/letters?slug=${encodeURIComponent(item.slug)}`}
                          isPublic={isPublic}
                          toggleContentStatusAction={toggleContentStatusAction}
                          updateContentMagazinesAction={updateContentMagazinesAction}
                          replaceContentFileAction={replaceContentFileAction}
                          deleteContentAction={deleteContentAction}
                          updateContentThumbnailAction={updateContentThumbnailAction}
                          updateContentTitleAction={updateContentTitleAction}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
