import { NextResponse } from "next/server";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { markAdminLetterNotificationsReadForGuestThread, normalizeThreadKey } from "@/lib/letters";
import { pingRoomNotificationSubscriber } from "@/lib/notification-push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json()) as { slug?: string };
  const slug = String(body.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const slugKey = normalizeThreadKey(slug);
  await markAdminLetterNotificationsReadForGuestThread(slugKey, session.guestId);

  pingRoomNotificationSubscriber(session.guestId);
  return NextResponse.json({ ok: true });
}
