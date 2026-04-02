"use client";

import Link from "next/link";
import { RoomBrand } from "@/app/components/room-brand";

export function RoomSidebar({
  id,
  onNavigate,
  secretPhrase
}: {
  id?: string;
  /** モバイルドロワー: リンクを押したら閉じる */
  onNavigate?: () => void;
  /** 台帳の秘密の言葉（ゲストのみ表示。未登録・管理者は null） */
  secretPhrase?: string | null;
}) {
  return (
    <aside
      id={id}
      className="room-sidebar"
      aria-label="室内メニュー"
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest("a[href]")) onNavigate?.();
      }}
    >
      <RoomBrand variant="sidebar" />

      <nav className="side-nav">
        <Link href={{ pathname: "/room", hash: "letters" }} scroll>
          <span className="material-symbols-outlined side-nav-icon" aria-hidden="true">
            menu_book
          </span>
          <span>最新の文字を読む</span>
        </Link>
        <Link href={{ pathname: "/room", hash: "works" }} scroll>
          <span className="material-symbols-outlined side-nav-icon" aria-hidden="true">
            auto_awesome
          </span>
          <span>きょうまでの特集</span>
        </Link>
        <Link href="/room/search">
          <span className="material-symbols-outlined side-nav-icon" aria-hidden="true">
            library_books
          </span>
          <span>すべての記事・マガジン</span>
        </Link>
        <Link href="/room/declaration">
          <span className="material-symbols-outlined side-nav-icon" aria-hidden="true">
            campaign
          </span>
          <span>しあわせに関する宣言</span>
        </Link>
        <a href="https://youtu.be/MQNu-AqtgYw">
          <span className="material-symbols-outlined side-nav-icon" aria-hidden="true">
            history_edu
          </span>
          <span>あの日の記憶</span>
        </a>
      </nav>

      <div className="sidebar-bottom">
        {secretPhrase ? (
          <p className="sidebar-secret-phrase">
            秘密の言葉：<strong>{secretPhrase}</strong>
          </p>
        ) : null}
        <Link href="/admin" className="sidebar-admin-link">
          <span className="material-symbols-outlined sidebar-admin-link-icon" aria-hidden="true">
            admin_panel_settings
          </span>
          <span>管理人向け</span>
        </Link>
        <p className="sidebar-foot">© 2026 GotoTatsuya</p>
      </div>
    </aside>
  );
}
