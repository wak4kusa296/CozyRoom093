import { AdminNav } from "@/app/admin/_nav";
import { requireAdminSession } from "@/app/admin/_auth";
import { MagazineCardList } from "@/app/admin/magazines/magazine-card-list";
import { MagazineAddForm } from "@/app/admin/magazines/magazine-add-form";
import {
  listContents,
  listMagazineSummaries,
  setContentMagazines,
  removeMagazineFromAllContents,
  renameMagazineInAllContents
} from "@/lib/content";
import {
  deleteMagazineContentOrder,
  getMagazineContentOrders,
  removeSlugFromMagazineContentOrder,
  renameMagazineContentOrder,
  setMagazineContentOrder,
  sortItemsByMagazineOrder
} from "@/lib/magazine-content-orders";
import { addMagazine, deleteMagazine, listMagazines, updateMagazine } from "@/lib/magazines";
import { revalidatePath } from "next/cache";

async function revalidateMagazineRelatedPaths() {
  revalidatePath("/admin/magazines");
  revalidatePath("/admin/content");
  revalidatePath("/room");
  revalidatePath("/room/search");
}

async function addMagazineAction(formData: FormData): Promise<{ ok: true; id: string } | { ok: false }> {
  "use server";
  await requireAdminSession();

  try {
    const mag = await addMagazine({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "")
    });
    await revalidateMagazineRelatedPaths();
    return { ok: true, id: mag.id };
  } catch {
    return { ok: false };
  }
}

async function updateMagazineAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  const previousName = String(formData.get("previousName") ?? "").trim();
  const nextName = String(formData.get("name") ?? "").trim();
  const nextDescription = String(formData.get("description") ?? "");

  try {
    await updateMagazine({
      id,
      name: nextName,
      description: nextDescription
    });
    if (previousName && nextName && previousName !== nextName) {
      await renameMagazineInAllContents(previousName, nextName);
      await renameMagazineContentOrder(previousName, nextName);
    }
  } catch {
    // Keep screen usable even if constraints fail.
  }
  await revalidateMagazineRelatedPaths();
}

async function deleteMagazineAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  try {
    await deleteMagazine(id);
    if (name) {
      await removeMagazineFromAllContents(name);
      await deleteMagazineContentOrder(name);
    }
  } catch {
    // Keep screen usable even if constraints fail.
  }
  await revalidateMagazineRelatedPaths();
}

async function updateMagazineContentOrderAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const magazineName = String(formData.get("magazineName") ?? "").trim();
  if (!magazineName) return;
  const orderedSlugs = formData
    .getAll("orderedSlugs")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const contents = await listContents();
  const validSlugSet = new Set(
    contents.filter((item) => item.magazines.includes(magazineName)).map((item) => item.slug)
  );
  const nextOrder = orderedSlugs.filter((slug) => validSlugSet.has(slug));
  await setMagazineContentOrder(magazineName, nextOrder);
  await revalidateMagazineRelatedPaths();
}

async function updateMagazineThumbnailAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const id = String(formData.get("id") ?? "");
  const thumbnail = String(formData.get("thumbnail") ?? "");
  if (!id) return;

  try {
    const magazines = await listMagazines();
    const target = magazines.find((m) => m.id === id);
    if (!target) return;
    await updateMagazine({ id, name: target.name, description: target.description, thumbnail });
  } catch {
    // Keep screen usable
  }
  await revalidateMagazineRelatedPaths();
}

async function removeContentFromMagazineAction(formData: FormData) {
  "use server";
  await requireAdminSession();

  const slug = String(formData.get("slug") ?? "").trim();
  const magazineName = String(formData.get("magazineName") ?? "").trim();
  if (!slug || !magazineName) return;

  const contents = await listContents();
  const target = contents.find((item) => item.slug === slug);
  if (!target || !target.magazines.includes(magazineName)) return;

  const nextMagazines = target.magazines.filter((name) => name !== magazineName);
  await setContentMagazines(slug, nextMagazines);
  await removeSlugFromMagazineContentOrder(magazineName, slug);
  await revalidateMagazineRelatedPaths();
}

export default async function AdminMagazinesPage() {
  await requireAdminSession();
  const [magazines, contents] = await Promise.all([listMagazines(), listContents()]);
  const contentOrders = await getMagazineContentOrders();
  const usage = new Map(listMagazineSummaries(contents).map((row) => [row.name, row.count]));
  const registeredNameSet = new Set(magazines.map((item) => item.name));
  const unregisteredInUse = Array.from(usage.keys()).filter((name) => !registeredNameSet.has(name));
  const contentsByMagazine = magazines.map((magazine) => {
    const matched = contents
      .filter((item) => item.magazines.includes(magazine.name))
      .map((item) => ({ slug: item.slug, title: item.title, date: item.date }));
    const ordered = sortItemsByMagazineOrder(matched, contentOrders[magazine.name] ?? []);
    return {
      magazineName: magazine.name,
      items: ordered.map((item) => ({ slug: item.slug, title: item.title }))
    };
  });

  return (
    <main className="landing admin-page-wrap">
      <section className="card admin-page-card">
        <div className="admin-page-header">
          <h1>マガジン管理</h1>
          <p className="lead">マガジンの追加・編集・削除ができます。</p>
        </div>
        <AdminNav />

        <section className="stack admin-panel">
          <h2>マガジン追加</h2>
          <MagazineAddForm addMagazineAction={addMagazineAction} updateMagazineThumbnailAction={updateMagazineThumbnailAction} />
        </section>

        {unregisteredInUse.length > 0 ? (
          <p className="meta">登録外のマガジン名が記事側に残っています: {unregisteredInUse.join(" / ")}</p>
        ) : null}

        {magazines.length === 0 ? (
          <p className="meta">まだマガジンはありません。</p>
        ) : (
          <MagazineCardList
            magazines={magazines}
            usageEntries={Array.from(usage.entries())}
            contentsByMagazine={contentsByMagazine}
            updateMagazineAction={updateMagazineAction}
            deleteMagazineAction={deleteMagazineAction}
            updateMagazineContentOrderAction={updateMagazineContentOrderAction}
            removeContentFromMagazineAction={removeContentFromMagazineAction}
            updateMagazineThumbnailAction={updateMagazineThumbnailAction}
          />
        )}
      </section>
    </main>
  );
}
