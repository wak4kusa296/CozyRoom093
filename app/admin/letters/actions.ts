"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/app/admin/_auth";
import { appendLetter, markGuestLetterNotificationsReadForThread } from "@/lib/letters";
import { pingRoomNotificationSubscriber } from "@/lib/notification-push";
import { sendWebPushToGuestIds } from "@/lib/web-push-deliver";

export type ReplyLetterState = { ok: boolean; version?: number };

export async function replyLetterAction(
  _prevState: ReplyLetterState,
  formData: FormData
): Promise<ReplyLetterState> {
  await requireAdminSession();
  const slug = String(formData.get("slug") ?? "").trim();
  const guestId = String(formData.get("guestId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!slug || !guestId || !body) {
    return { ok: false, version: Date.now() };
  }

  await appendLetter(slug, guestId, {
    sender: "管理者",
    body,
    createdAt: new Date().toISOString()
  });

  await markGuestLetterNotificationsReadForThread(slug, guestId);

  revalidatePath("/admin/letters");
  revalidatePath(`/room/${encodeURIComponent(slug)}`);

  pingRoomNotificationSubscriber(guestId);

  try {
    const preview = body.length > 100 ? `${body.slice(0, 100)}…` : body;
    await sendWebPushToGuestIds([guestId], {
      title: "管理人からの便り",
      body: preview || "文通に返信がありました。",
      url: `/room/${encodeURIComponent(slug)}`
    });
  } catch (e) {
    console.error("[replyLetterAction] web push", e);
  }

  return { ok: true, version: Date.now() };
}
