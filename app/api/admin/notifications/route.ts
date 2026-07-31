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
import {
  countUnreadSignupNotifications,
  listSignupNotifications,
  markSignupNotificationRead
} from "@/lib/signup-notifications";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";
import { jsonError, jsonOk, parseJsonBody } from "@/lib/http-json";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return jsonError("forbidden", "管理者権限が必要です。", { status: 403 });
  }

  const viewParam = new URL(request.url).searchParams.get("view");
  const view = viewParam === "history" ? "history" : "unread";

  const [recoveryRows, signupRows, letterEvents, letterReads, guests] = await Promise.all([
    listRecoveryRequests(),
    listSignupNotifications(),
    listGuestLetterEvents(),
    getLetterNotificationReads(),
    listGuestCredentials()
  ]);

  const recoveryGuestOptions = guests.map((g) => ({
    guestId: g.guestId,
    guestName: g.guestName
  }));

  const recoveryItems = recoveryRows
    .filter((row) => (view === "history" ? Boolean(row.readAt) : !row.readAt))
    .map((row) => ({
      kind: "recovery" as const,
      id: row.id,
      createdAt: row.createdAt,
      readAt: row.readAt ?? null,
      hintName: row.hintName,
      hintPlace: row.hintPlace,
      contactEmail: row.contactEmail ?? ""
    }));

  const signupItems = signupRows
    .filter((row) => (view === "history" ? Boolean(row.readAt) : !row.readAt))
    .map((row) => ({
      kind: "signup" as const,
      id: row.id,
      createdAt: row.createdAt,
      readAt: row.readAt ?? null,
      guestId: row.guestId,
      guestName: row.guestName,
      memo: row.memo,
      emailSent: row.emailSent
    }));

  const letterItems = letterEvents
    .filter((e) => (view === "history" ? Boolean(letterReads[e.id]) : !letterReads[e.id]))
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

  const items = [...recoveryItems, ...signupItems, ...letterItems].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  );

  const recoveryUnread = countUnreadRecoveryRequests(recoveryRows);
  const signupUnread = countUnreadSignupNotifications(signupRows);
  const letterUnread = letterEvents.filter((e) => !letterReads[e.id]).length;
  const unreadCount = recoveryUnread + signupUnread + letterUnread;

  return jsonOk({
    items,
    unreadCount,
    view,
    smtpConfigured: isSmtpConfigured(),
    recoveryGuestOptions
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return jsonError("forbidden", "管理者権限が必要です。", { status: 403 });
  }

  const body = await parseJsonBody<{ id?: string }>(request);
  if (!body) return jsonError("invalid_json", "送信内容を読み取れませんでした。", { status: 400 });
  const id = String(body.id ?? "").trim();
  if (!id) {
    return jsonError("invalid_notification_id", "通知を指定してください。", { status: 400 });
  }

  const recoveryOk = await markRecoveryRequestRead(id);
  if (recoveryOk) {
    pingAdminNotificationSubscribers();
    return jsonOk({});
  }

  const signupOk = await markSignupNotificationRead(id);
  if (signupOk) {
    pingAdminNotificationSubscribers();
    return jsonOk({});
  }

  if (id.startsWith("letter|")) {
    await markLetterNotificationRead(id);
    pingAdminNotificationSubscribers();
    return jsonOk({});
  }

  return jsonError("notification_not_found", "指定した通知が見つかりません。", { status: 404 });
}
