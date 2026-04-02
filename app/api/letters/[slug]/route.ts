import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appendLetter, getLetters, markGuestLetterNotificationsReadForThread } from "@/lib/letters";
import { normalizeSlugParam } from "@/lib/content";
import { pingAdminNotificationSubscribers, pingRoomNotificationSubscriber } from "@/lib/notification-push";
import { sendWebPushGuestLetterToAdmins } from "@/lib/web-push-guest-letter-to-admin";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const { slug } = await context.params;
  const normalizedSlug = normalizeSlugParam(slug);
  const letters = await getLetters(normalizedSlug, session.guestId);
  return NextResponse.json({ letters });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await request.json()) as { body?: string };
  if (!body.body?.trim()) return NextResponse.json({ ok: false }, { status: 400 });

  const guestFromQuery = new URL(request.url).searchParams.get("guest") ?? "";
  const targetGuestId = session.role === "admin" && guestFromQuery ? guestFromQuery : session.guestId;
  const { slug } = await context.params;
  const normalizedSlug = normalizeSlugParam(slug);
  const letters = await appendLetter(normalizedSlug, targetGuestId, {
    sender: session.guestName,
    body: body.body.trim(),
    createdAt: new Date().toISOString()
  });

  if (session.role === "admin") {
    await markGuestLetterNotificationsReadForThread(normalizedSlug, targetGuestId);
    pingRoomNotificationSubscriber(targetGuestId);
  } else {
    pingAdminNotificationSubscribers();
    void sendWebPushGuestLetterToAdmins({
      slug: normalizedSlug,
      guestId: targetGuestId,
      senderName: session.guestName
    }).catch(() => {});
  }

  return NextResponse.json({ letters });
}
