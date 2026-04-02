import { NextResponse, type NextRequest } from "next/server";
import { fetchLinkPreview } from "@/lib/link-preview";

function resolveRequestUrl(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    if (base) {
      try {
        return new URL(t, `${base}/`).href;
      } catch {
        return t;
      }
    }
  }
  return t;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_url" }, { status: 400 });
  }

  const preview = await fetchLinkPreview(resolveRequestUrl(raw));
  if (!preview) {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 502 });
  }

  return NextResponse.json(
    { ok: true, preview },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
      }
    }
  );
}
