import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeIcon } from "@/app/components/home-icon";
import { getSession } from "@/lib/auth";
import { listContents, listPublicContents, normalizeSlugParam } from "@/lib/content";
import { getMagazineContentOrders, sortItemsByMagazineOrder } from "@/lib/magazine-content-orders";
import { getFirstRegisteredMagazineThumbnail, listMagazines } from "@/lib/magazines";
import { BookshelfCarousel } from "../../bookshelf-carousel";

export default async function MagazinePage({
  params
}: {
  params: Promise<{ magazine: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const { magazine } = await params;
  const resolvedMagazine = normalizeSlugParam(magazine);
  const [items, orders, magazines, firstRegisteredMagazineThumbnail] = await Promise.all([
    session.role === "admin" ? listContents() : listPublicContents(),
    getMagazineContentOrders(),
    listMagazines(),
    getFirstRegisteredMagazineThumbnail()
  ]);
  const magazineThumbnails: Record<string, string> = {};
  for (const mag of magazines) {
    if (mag.thumbnail) magazineThumbnails[mag.name] = mag.thumbnail;
  }
  const matched = items.filter((item) => item.magazines.includes(resolvedMagazine));
  const orderedItems = sortItemsByMagazineOrder(matched, orders[resolvedMagazine] ?? []);
  const magMeta = magazines.find((m) => m.name === resolvedMagazine);

  return (
    <main className="room">
      <section id="works">
        <p className="meta">
          <Link href="/room" className="room-top-page-link">
            <HomeIcon />
            トップページへ戻る
          </Link>
        </p>

        <header className="magazine-page-hero">
          <div
            className="magazine-page-hero-thumb"
            aria-hidden={magMeta?.thumbnail ? undefined : true}
          >
            {magMeta?.thumbnail ? (
              <img
                src={`/thumbnails/${magMeta.thumbnail}`}
                alt=""
                className="magazine-page-hero-img"
              />
            ) : null}
          </div>
          <h1 className="magazine-page-hero-title">{resolvedMagazine}</h1>
          {magMeta?.description ? (
            <p className="magazine-page-hero-desc">{magMeta.description}</p>
          ) : null}
        </header>

        <BookshelfCarousel
          variant="magazine"
          items={orderedItems}
          magazineThumbnails={magazineThumbnails}
          firstRegisteredMagazineThumbnail={firstRegisteredMagazineThumbnail}
        />
      </section>
    </main>
  );
}
