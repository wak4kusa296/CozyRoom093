"use client";

import { useCallback, useEffect, useState } from "react";
import { RoomBrand, RoomLogo } from "@/app/components/room-brand";
import { RoomPushNotifyBanner } from "@/app/components/room-push-notify-banner";
import { RoomNotificationBell } from "./room-notification-bell";
import { RoomSidebar } from "./sidebar";

export function RoomShellClient({
  children,
  sidebarSecretPhrase,
  showPushNotifyBanner,
  showAdminSidebarLink
}: {
  children: React.ReactNode;
  /** ログイン中ゲストの台帳にある秘密の言葉（未登録なら null） */
  sidebarSecretPhrase?: string | null;
  /** ブラウザ通知バナーを出す（未ログインなら false） */
  showPushNotifyBanner?: boolean;
  /** 管理画面の秘密でログインしたセッションのみ true（サイドバーの管理人導線） */
  showAdminSidebarLink?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    function onChange() {
      if (!mq.matches) {
        setNavOpen(false);
        document.body.style.overflow = "";
      }
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    if (!navOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeNav();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen, closeNav]);

  return (
    <div className={navOpen ? "room-shell room-shell--nav-open" : "room-shell"}>
      <button
        type="button"
        className="room-sidebar-backdrop"
        aria-label="メニューを閉じる"
        tabIndex={navOpen ? 0 : -1}
        onClick={closeNav}
      />
      <div className="admin-global-topbar">
        <div className="admin-global-topbar-cluster">
          <RoomNotificationBell />
          <button
            type="button"
            className="room-mobile-menu-trigger"
            onClick={toggleNav}
            aria-expanded={navOpen}
            aria-controls="room-sidebar-nav"
            title="室内メニュー"
          >
            <RoomLogo />
            <span className="sr-only">室内メニューを開く</span>
          </button>
        </div>
      </div>
      <RoomSidebar
        id="room-sidebar-nav"
        onNavigate={closeNav}
        secretPhrase={sidebarSecretPhrase ?? null}
        showAdminLink={showAdminSidebarLink ?? false}
      />
      <div className="room-main">
        {children}
        <footer className="room-site-footer" aria-label="サイト情報">
          <RoomBrand variant="sidebar" />
          <div className="sidebar-bottom">
            {sidebarSecretPhrase ? (
              <p className="sidebar-secret-phrase">
                秘密の言葉：<strong>{sidebarSecretPhrase}</strong>
              </p>
            ) : null}
            <p className="sidebar-foot">© 2026 GotoTatsuya</p>
          </div>
        </footer>
      </div>
      <RoomPushNotifyBanner enabled={showPushNotifyBanner ?? false} />
    </div>
  );
}
