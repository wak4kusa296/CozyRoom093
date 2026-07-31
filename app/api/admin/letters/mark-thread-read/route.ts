import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseJsonBody } from "@/lib/http-json";
import { markAllGuestLetterNotificationReadsForAdminThread } from "@/lib/letters";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const parsed = await parseJsonBody<{ slugKey?: string; guestKey?: string }>(request);
  if (!parsed) return NextResponse.json({ ok: false }, { status: 400 });

  const slugKey = String(parsed.slugKey ?? "").trim();
  const guestKey = String(parsed.guestKey ?? "").trim();
  if (!slugKey || !guestKey) return NextResponse.json({ ok: false }, { status: 400 });

  await markAllGuestLetterNotificationReadsForAdminThread(slugKey, guestKey);
  pingAdminNotificationSubscribers();

  return NextResponse.json({ ok: true });
}
