import Link from "next/link";
import { redirect } from "next/navigation";
import { HomeIcon } from "@/app/components/home-icon";
import { getSession } from "@/lib/auth";

export default async function DeclarationPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <main className="declaration-page">
      <nav className="article-breadcrumb declaration-page-breadcrumb section-title section-title-sub" aria-label="パンくず">
        <Link href="/room" className="room-top-page-link">
          <HomeIcon />
          トップページ
        </Link>
        <span aria-hidden="true">/</span>
        <span>しあわせに関する宣言</span>
      </nav>

      <section className="declaration-page-content article-body">
        <h1>しあわせに関する宣言</h1>
        <p>ここは、互いに為し合わせることで生まれる「しあわせ」の場所。</p>
        <ol className="declaration-principles">
          <li>ここでは、誰も何かを強いられない。</li>
          <li>ここでは、誰も何かと比べられない。</li>
          <li>ここでは、記録より、心に残るものが大切にされる。</li>
          <li>ここでは、沈黙も、言葉と同じように守られる。</li>
        </ol>
        <p>もしこの約束が脅かされたら、 わたしたちは、あくまで「しあわせ」を守る。</p>
      </section>
    </main>
  );
}
