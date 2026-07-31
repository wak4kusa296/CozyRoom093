import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseJsonBody } from "@/lib/http-json";
import { markAllGuestLetterNotificationReadsForAdminThread } from "@/lib/letters";
import { pingAdminNotificationSubscribers } from "@/lib/notification-push";
import { jsonError, jsonOk } from "@/lib/http-json";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return jsonError("forbidden", "管理者権限が必要です。", { status: 403 });
  }

  const parsed = await parseJsonBody<{ slugKey?: string; guestKey?: string }>(request);
  if (!parsed) return jsonError("invalid_json", "送信内容を読み取れませんでした。", { status: 400 });

  const slugKey = String(parsed.slugKey ?? "").trim();
  const guestKey = String(parsed.guestKey ?? "").trim();
  if (!slugKey || !guestKey) {
    return jsonError("invalid_thread", "文通スレッドを指定してください。", { status: 400 });
  }

  await markAllGuestLetterNotificationReadsForAdminThread(slugKey, guestKey);
  pingAdminNotificationSubscribers();

  return jsonOk({});
}
