"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/app/admin/_auth";
import { letterMutationErrorPayload, postLetterMutation } from "@/lib/letters-mutations";

export type ReplyLetterState = { ok: boolean; version?: number; error?: string; slug?: string; guestId?: string };

export async function replyLetterAction(
  _prevState: ReplyLetterState,
  formData: FormData
): Promise<ReplyLetterState> {
  const session = await requireAdminSession();
  const slug = String(formData.get("slug") ?? "").trim();
  const guestId = String(formData.get("guestId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!slug || !guestId) {
    return { ok: false, version: Date.now(), error: "送信先を確認してください。" };
  }

  try {
    await postLetterMutation({
      actor: { role: "admin", guestId: session.guestId, guestName: session.guestName },
      targetGuestId: guestId,
      slug,
      body
    });
    revalidatePath("/admin/letters");
    revalidatePath(`/room/${encodeURIComponent(slug)}`);
    return { ok: true, version: Date.now() };
  } catch (error) {
    return { ok: false, version: Date.now(), error: letterMutationErrorPayload(error).body.error.message };
  }
}

export async function composeLetterAction(
  _prevState: ReplyLetterState,
  formData: FormData
): Promise<ReplyLetterState> {
  const session = await requireAdminSession();
  const guestId = String(formData.get("guestId") ?? "").trim();
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!guestId) return { ok: false, version: Date.now(), error: "送信先を確認してください。" };
  try {
    const { createStandaloneLetterMutation } = await import("@/lib/letters-mutations");
    const created = await createStandaloneLetterMutation({
      actor: { role: "admin", guestId: session.guestId, guestName: session.guestName },
      targetGuestId: guestId,
      title,
      body
    });
    revalidatePath("/admin/letters");
    revalidatePath("/room/letters");
    return { ok: true, version: Date.now(), slug: created.slug, guestId };
  } catch (error) {
    return { ok: false, version: Date.now(), error: letterMutationErrorPayload(error).body.error.message };
  }
}
