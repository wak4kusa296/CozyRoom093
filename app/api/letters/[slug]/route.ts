import { NextResponse } from "next/server";
import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { appendLetter, getLetters, markGuestLetterNotificationsReadForThread } from "@/lib/letters";
import { normalizeSlugParam } from "@/lib/content";
import { pingAdminNotificationSubscribers, pingRoomNotificationSubscriber } from "@/lib/notification-push";
import { sendWebPushGuestLetterToAdmins } from "@/lib/web-push-guest-letter-to-admin";
import { sendWebPushToGuestIds } from "@/lib/web-push-deliver";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const guestFromQuery = new URL(request.url).searchParams.get("guest") ?? "";
  const targetGuestId = session.role === "admin" && guestFromQuery ? guestFromQuery : session.guestId;
  const { slug } = await context.params;
  const normalizedSlug = normalizeSlugParam(slug);
  const letters = await getLetters(normalizedSlug, targetGuestId);
  return NextResponse.json({ letters });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRevokeIfGuestInactive();
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
    try {
      const text = body.body.trim();
      const preview = text.length > 100 ? `${text.slice(0, 100)}…` : text;
      await sendWebPushToGuestIds([targetGuestId], {
        title: "管理人からの便り",
        body: preview || "文通に返信がありました。",
        url: `/room/${encodeURIComponent(normalizedSlug)}?letters=open`
      });
    } catch (e) {
      console.error("[letters POST] web push to guest", e);
    }
  } else {
    pingAdminNotificationSubscribers();
    try {
      await sendWebPushGuestLetterToAdmins({
        slug: normalizedSlug,
        guestId: targetGuestId,
        senderName: session.guestName
      });
    } catch (e) {
      console.error("[letters POST] web push to admins failed", e);
    }
  }

  return NextResponse.json({ letters });
}
