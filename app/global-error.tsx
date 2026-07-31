"use client";

import "./globals.css";
import Link from "next/link";
import { RoomBrand } from "@/app/components/room-brand";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body>
        <main className="landing">
          <section className="card">
            <RoomBrand variant="landing" />
            <div className="stack">
              <h1>一時的に表示できません</h1>
              <p className="meta">しばらくしてから、もう一度お試しください。</p>
              <button type="button" className="ui-button ui-button--primary" onClick={reset}>
                もう一度試す
              </button>
            </div>
            <nav className="landing-secondary-actions" aria-label="ページ移動">
              <Link href="/" className="text-link">
                入室ページへ戻る
              </Link>
            </nav>
          </section>
        </main>
      </body>
    </html>
  );
}
