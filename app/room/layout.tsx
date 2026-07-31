import { enforceGuestSessionActiveOrRedirect, getSession } from "@/lib/auth";
import { RoomShellClient } from "./room-shell-client";

export const dynamic = "force-dynamic";

export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  await enforceGuestSessionActiveOrRedirect();
  const session = await getSession();

  return (
    <RoomShellClient
      showPushNotifyBanner={!!session}
      showAdminSidebarLink={session?.role === "admin"}
    >
      {children}
    </RoomShellClient>
  );
}
