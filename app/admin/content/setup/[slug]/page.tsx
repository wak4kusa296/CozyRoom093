import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { getContentBySlug, normalizeSlugParam, setContentMagazines, setContentStatus, setContentTitle } from "@/lib/content";
import { listMagazines } from "@/lib/magazines";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

async function saveInitialContentSetupAction(formData: FormData) {
  "use server";

  await requireAdminSession();
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "private");
  const magazines = formData
    .getAll("magazines")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!slug || !title) return;
  if (status !== "public" && status !== "private") return;

  await setContentTitle(slug, title);
  await setContentStatus(slug, status);
  await setContentMagazines(slug, magazines);

  revalidatePath("/admin/content");
  revalidatePath("/admin/magazines");
  revalidatePath(`/admin/content/setup/${encodeURIComponent(slug)}`);
  revalidatePath("/room");
  revalidatePath("/room/search");
  revalidatePath(`/room/${encodeURIComponent(slug)}`);

  redirect("/admin/content");
}

export default async function AdminContentSetupPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdminSession();
  const { slug } = await params;
  const normalizedSlug = normalizeSlugParam(slug);
  const [item, magazines] = await Promise.all([
    getContentBySlug(normalizedSlug).catch(() => null),
    listMagazines()
  ]);
  if (!item) notFound();

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card">
        <div className="admin-page-header">
          <h1>アップロード後の初期設定</h1>
          <p className="lead">タイトル、公開状態、登録マガジンを設定してください。</p>
        </div>
        <AdminNav />

        <section className="stack admin-panel">
          <h2>対象ファイル: {item.slug}.md</h2>
          <form action={saveInitialContentSetupAction} className="stack">
            <input type="hidden" name="slug" value={item.slug} />
            <label>
              タイトル
              <input name="title" defaultValue={item.title} required />
            </label>
            <fieldset className="admin-status-toggle-group">
              <legend>公開状態</legend>
              <label className="admin-status-toggle-item">
                <input type="radio" name="status" value="private" defaultChecked={item.status === "private"} />
                <span>非公開</span>
              </label>
              <label className="admin-status-toggle-item">
                <input type="radio" name="status" value="public" defaultChecked={item.status === "public"} />
                <span>公開</span>
              </label>
            </fieldset>
            <fieldset className="admin-magazine-checklist">
              <legend>登録マガジン</legend>
              {magazines.length === 0 ? (
                <p className="meta">マガジンが未登録です。先にマガジン管理で追加してください。</p>
              ) : (
                magazines.map((magazine) => (
                  <label key={magazine.id} className="admin-magazine-check-item">
                    <input
                      type="checkbox"
                      name="magazines"
                      value={magazine.name}
                      defaultChecked={item.magazines.includes(magazine.name)}
                    />
                    <span>{magazine.name}</span>
                  </label>
                ))
              )}
            </fieldset>
            <button type="submit" className="admin-add-button">
              保存して記事管理へ戻る
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
