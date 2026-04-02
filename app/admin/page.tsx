"use client";

import { RoomBrand } from "@/app/components/room-brand";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type HeartSummaryRow = {
  slug: string;
  title: string;
  total: number;
  uniqueGuests: number;
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<HeartSummaryRow[] | null>(null);

  async function loadSummary(showErrorMessage = true) {
    const response = await fetch("/api/admin/hearts");
    if (!response.ok) {
      if (showErrorMessage) {
        setMessage("管理情報の取得に失敗しました。");
      }
      return;
    }

    const data = (await response.json()) as { rows?: HeartSummaryRow[] };
    setRows(data.rows ?? []);
  }

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/hearts");
      if (!response.ok) return;
      const data = (await response.json()) as { rows?: HeartSummaryRow[] };
      setRows(data.rows ?? []);
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/admin/enter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret })
    });

    if (response.ok) {
      await loadSummary();
      return;
    }

    setMessage("秘密の言葉が違うようです");
  }

  return (
    <main className="landing admin-page-wrap admin-home">
      <RoomBrand variant="landing" />
      <section
        className={`card admin-page-card${!rows ? " admin-page-card--gate" : ""}`}
      >
        <div className="admin-page-header">
          <h1>管理画面</h1>
        </div>

        {!rows ? (
          <form onSubmit={onSubmit} className="stack">
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="管理者専用のことば"
              required
              type="password"
            />
            <button type="submit">確認する</button>
          </form>
        ) : (
          <section className="admin-panel" aria-label="管理ダッシュボード">
            <h2>管理メニュー</h2>
            <div className="admin-nav-grid">
              <Link href="/admin/ledger" className="admin-nav-card">
                <span className="material-symbols-outlined admin-nav-card-icon" aria-hidden="true">
                  group
                </span>
                <h3>ユーザー管理</h3>
                <p className="meta">ユーザーと秘密の言葉の対応表を編集します。</p>
              </Link>
              <Link href="/admin/content" className="admin-nav-card">
                <span className="material-symbols-outlined admin-nav-card-icon" aria-hidden="true">
                  edit_note
                </span>
                <h3>記事管理</h3>
                <p className="meta">記事の一覧・公開状態・Markdown・マガジンへの割り当てを管理します。</p>
              </Link>
              <Link href="/admin/magazines" className="admin-nav-card">
                <span className="material-symbols-outlined admin-nav-card-icon" aria-hidden="true">
                  collections_bookmark
                </span>
                <h3>マガジン管理</h3>
                <p className="meta">マガジン本体の追加・名前変更・削除と、記事の並びを管理します。</p>
              </Link>
              <Link href="/admin/letters" className="admin-nav-card">
                <span className="material-symbols-outlined admin-nav-card-icon" aria-hidden="true">
                  mail
                </span>
                <h3>文通管理</h3>
                <p className="meta">各文通スレッドの最新状況を確認します。</p>
              </Link>
              <Link href="/admin/push" className="admin-nav-card">
                <span className="material-symbols-outlined admin-nav-card-icon" aria-hidden="true">
                  notifications
                </span>
                <h3>プッシュ通知</h3>
                <p className="meta">通知配信の準備状態を確認します。</p>
              </Link>
            </div>
          </section>
        )}

        {!rows && message ? <p className="message">{message}</p> : null}
      </section>
    </main>
  );
}
