import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listGuestCredentials } from "@/lib/guest-credentials";
import { getLetterNotificationReads, markLetterNotificationRead } from "@/lib/letter-notification-reads";
import { listGuestLetterEvents } from "@/lib/letters";
import { isSmtpConfigured } from "@/lib/mail";
import {
  countUnreadRecoveryRequests,
  listRecoveryRequests,
  markRecoveryRequestRead
} from "@/lib/recovery-requests";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const [recoveryRows, letterEvents, letterReads, guests] = await Promise.all([
    listRecoveryRequests(),
    listGuestLetterEvents(),
    getLetterNotificationReads(),
    listGuestCredentials()
  ]);

  const recoveryGuestOptions = guests.map((g) => ({
    guestId: g.guestId,
    guestName: g.guestName
  }));

  const recoveryItems = recoveryRows
    .filter((row) => !row.readAt)
    .map((row) => ({
      kind: "recovery" as const,
      id: row.id,
      createdAt: row.createdAt,
      readAt: row.readAt ?? null,
      hintName: row.hintName,
      hintPlace: row.hintPlace,
      contactEmail: row.contactEmail ?? ""
    }));

  const letterItems = letterEvents
    .filter((e) => !letterReads[e.id])
    .map((e) => ({
      kind: "letter" as const,
      id: e.id,
      createdAt: e.createdAt,
      readAt: letterReads[e.id] ?? null,
      slugKey: e.slugKey,
      guestKey: e.guestKey,
      sender: e.sender,
      body: e.body
    }));

  const items = [...recoveryItems, ...letterItems].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );

  const recoveryUnread = countUnreadRecoveryRequests(recoveryRows);
  const letterUnread = letterEvents.filter((e) => !letterReads[e.id]).length;
  const unreadCount = recoveryUnread + letterUnread;

  return NextResponse.json({
    ok: true,
    items,
    unreadCount,
    smtpConfigured: isSmtpConfigured(),
    recoveryGuestOptions
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string };
  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const recoveryOk = await markRecoveryRequestRead(id);
  if (recoveryOk) {
    pingAdminNotificationSubscribers();
    return NextResponse.json({ ok: true });
  }

  if (id.startsWith("letter|")) {
    await markLetterNotificationRead(id);
    pingAdminNotificationSubscribers();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 404 });
}
