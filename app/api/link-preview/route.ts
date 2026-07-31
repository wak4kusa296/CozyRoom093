import { NextResponse, type NextRequest } from "next/server";
import { fetchLinkPreview } from "@/lib/link-preview";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { toPublicAbsoluteHref } from "@/lib/public-url";

function resolveRequestUrl(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) {
    return toPublicAbsoluteHref(t);
  }
  return t;
}

export async function GET(req: NextRequest) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session || (session.role !== "guest" && session.role !== "admin")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

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
        "Cache-Control": "private, max-age=3600"
      }
    }
  );
}
