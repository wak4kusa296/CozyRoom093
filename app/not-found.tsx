import Link from "next/link";
import { RoomBrand } from "@/app/components/room-brand";

export default function NotFound() {
  return (
    <main className="landing">
      <section className="card">
        <RoomBrand variant="landing" />
        <div className="stack">
          <h1>ページが見つかりません</h1>
          <p className="meta">お探しのページは移動したか、存在しないようです。</p>
        </div>
        <nav className="landing-secondary-actions" aria-label="ページ移動">
          <Link href="/" className="text-link">
            入室ページへ戻る
          </Link>
          <Link href="/room" className="text-link">
            部屋のトップへ
          </Link>
        </nav>
      </section>
    </main>
  );
}
