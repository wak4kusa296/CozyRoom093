import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listAdminLetterEventsForGuest, normalizeThreadKey } from "@/lib/letters";
import { markGuestNotificationRead } from "@/lib/guest-notification-reads";
import { pingRoomNotificationSubscriber } from "@/lib/notification-push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as { slug?: string };
  const slug = String(body.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const slugKey = normalizeThreadKey(slug);
  const rows = await listAdminLetterEventsForGuest(session.guestId);
  for (const row of rows) {
    if (row.slugKey === slugKey) {
      await markGuestNotificationRead(session.guestId, row.id);
    }
  }

  pingRoomNotificationSubscriber(session.guestId);
  return NextResponse.json({ ok: true });
}
