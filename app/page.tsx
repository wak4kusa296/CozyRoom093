import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { HomePageClient } from "./home-page-client";

/** 有効なセッションがあれば合言葉入力をスキップ（Cookie は lib/auth の maxAge に従う） */
export default async function HomePage() {
  const session = await getSession();
  if (session) {
    redirect(session.role === "admin" ? "/admin" : "/room");
  }
  return <HomePageClient />;
}
