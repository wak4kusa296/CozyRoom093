import { redirect } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth";
import { isGuestCredentialActive } from "@/lib/guest-credentials";
import { HomePageClient } from "./home-page-client";

/** Cookie を見たリダイレクトが CDN 等で固定化されないようにする */
export const dynamic = "force-dynamic";

/** 有効なセッションがあれば合言葉入力をスキップ（Cookie は lib/auth の maxAge に従う） */
export default async function HomePage() {
  let session = await getSession();
  if (session?.role === "guest") {
    const active = await isGuestCredentialActive(session.guestId);
    if (!active) {
      await clearSession();
      session = null;
    }
  }
  if (session) {
    redirect(session.role === "admin" ? "/admin" : "/room");
  }
  return <HomePageClient />;
}
