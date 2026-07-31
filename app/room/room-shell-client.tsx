"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RoomBrand, RoomLogo } from "@/app/components/room-brand";
import { RoomPushNotifyBanner } from "@/app/components/room-push-notify-banner";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { RoomNotificationBell } from "./room-notification-bell";
import { RoomSidebar } from "./sidebar";

export function RoomShellClient({
  children,
  showPushNotifyBanner,
  showAdminSidebarLink
}: {
  children: React.ReactNode;
  /** ブラウザ通知バナーを出す（未ログインなら false） */
  showPushNotifyBanner?: boolean;
  /** 管理画面の秘密でログインしたセッションのみ true（サイドバーの管理人導線） */
  showAdminSidebarLink?: boolean;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);
  useFocusTrap(sidebarRef, navOpen, closeNav);

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
        sidebarRef={sidebarRef}
        onNavigate={closeNav}
        showAdminLink={showAdminSidebarLink ?? false}
      />
      <div className="room-main">
        {children}
        <footer className="room-site-footer" aria-label="サイト情報">
          <RoomBrand variant="sidebar" />
          <div className="sidebar-bottom">
            <form action="/api/logout" method="post" className="sidebar-logout-form">
              <button type="submit" className="sidebar-admin-link sidebar-logout-button">
                <span className="material-symbols-outlined sidebar-admin-link-icon" aria-hidden="true">
                  logout
                </span>
                <span>部屋を出る</span>
              </button>
            </form>
            <p className="sidebar-foot">© 2026 GotoTatsuya</p>
          </div>
        </footer>
      </div>
      <RoomPushNotifyBanner enabled={showPushNotifyBanner ?? false} />
    </div>
  );
}
