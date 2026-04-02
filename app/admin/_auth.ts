import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }
  return session;
}
