import type { Metadata } from "next";
import { JoinPageClient } from "./join-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "新規登録",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
};

export default function JoinPage() {
  return <JoinPageClient />;
}
