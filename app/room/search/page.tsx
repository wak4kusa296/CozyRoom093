import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listContents, listMagazineSummaries, listPublicContents } from "@/lib/content";
import { getFirstRegisteredMagazineThumbnail, listMagazines } from "@/lib/magazines";
import { RoomSearchClient } from "../room-search-client";

export default async function RoomSearchPage({
  searchParams
}: {
  searchParams: Promise<{ tag?: string | string[]; magazine?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const tagFromQuery = Array.isArray(resolvedSearchParams.tag)
    ? resolvedSearchParams.tag[0] ?? ""
    : resolvedSearchParams.tag ?? "";
  const magazineFromQuery = Array.isArray(resolvedSearchParams.magazine)
    ? resolvedSearchParams.magazine[0] ?? ""
    : resolvedSearchParams.magazine ?? "";

  const [items, magazines, firstRegisteredMagazineThumbnail] = await Promise.all([
    session.role === "admin" ? listContents() : listPublicContents(),
    listMagazines(),
    getFirstRegisteredMagazineThumbnail()
  ]);
  const magazineThumbnails: Record<string, string> = {};
  for (const mag of magazines) {
    if (mag.thumbnail) magazineThumbnails[mag.name] = mag.thumbnail;
  }
  const magazineSummaries = listMagazineSummaries(items);
  const allTags = Array.from(new Set(items.flatMap((i) => i.tags))).sort((a, b) =>
    a.localeCompare(b, "ja")
  );
  const initialQuery = (tagFromQuery || magazineFromQuery).trim();

  return (
    <RoomSearchClient
      items={items}
      magazineSummaries={magazineSummaries}
      magazinesMeta={magazines.map((m) => ({
        name: m.name,
        description: m.description,
        thumbnail: m.thumbnail
      }))}
      magazineThumbnails={magazineThumbnails}
      firstRegisteredMagazineThumbnail={firstRegisteredMagazineThumbnail}
      allTags={allTags}
      initialQuery={initialQuery}
    />
  );
}
