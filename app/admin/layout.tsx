import Link from "next/link";
import { getSession } from "@/lib/auth";
import { RoomLogo } from "@/app/components/room-brand";
import { RoomPushNotifyBanner } from "@/app/components/room-push-notify-banner";
import { AdminNotificationBell } from "@/app/admin/admin-notification-bell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const showAdminPushBanner = session?.role === "admin";

  return (
    <>
      <div className="admin-global-topbar">
        <div className="admin-global-topbar-cluster">
          <AdminNotificationBell />
          <Link
            href="/room"
            className="room-mobile-menu-trigger"
            title="室内（トップ）へ"
            aria-label="室内（トップ）へ"
          >
            <RoomLogo />
            <span className="sr-only">室内（トップ）へ</span>
          </Link>
        </div>
      </div>
      {showAdminPushBanner ? (
        <RoomPushNotifyBanner
          enabled
          dismissStorageKey="admin-push-banner-dismissed"
          description="他の方から手紙が届いたとき、端末の通知でもお知らせします（管理画面上部のベルと同じ内容です）。"
        />
      ) : null}
      {children}
    </>
  );
}
