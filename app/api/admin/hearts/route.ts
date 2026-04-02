import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listContents } from "@/lib/content";
import { listHeartSummaries } from "@/lib/hearts";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const [contents, summaries] = await Promise.all([listContents(), listHeartSummaries()]);
  const titleBySlug = new Map(contents.map((item) => [item.slug, item.title]));
  const rows = summaries.map((summary) => ({
    slug: summary.slug,
    title: titleBySlug.get(summary.slug) ?? summary.slug,
    total: summary.total,
    uniqueGuests: summary.uniqueGuests
  }));

  return NextResponse.json({ ok: true, rows });
}
