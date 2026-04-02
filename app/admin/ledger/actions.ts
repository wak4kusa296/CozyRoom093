"use server";

import { requireAdminSession } from "@/app/admin/_auth";
import { deleteGuestCredential } from "@/lib/guest-credentials";
import { revalidatePath } from "next/cache";

export async function deleteGuestAction(formData: FormData) {
  await requireAdminSession();
  const guestId = String(formData.get("guestId") ?? "").trim();
  if (!guestId) return;
  try {
    await deleteGuestCredential(guestId);
  } catch {
    /* 制約等で失敗しても画面は維持 */
  }
  revalidatePath("/admin/ledger");
}
