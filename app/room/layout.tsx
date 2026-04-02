import { enforceGuestSessionActiveOrRedirect, getSession } from "@/lib/auth";
import { getPassphraseByGuestId } from "@/lib/guest-credentials";
import { RoomShellClient } from "./room-shell-client";

export const dynamic = "force-dynamic";

export default async function RoomLayout({ children }: { children: React.ReactNode }) {
  await enforceGuestSessionActiveOrRedirect();
  const session = await getSession();
  let secretPhrase: string | null = null;
  if (session) {
    try {
      secretPhrase = await getPassphraseByGuestId(session.guestId);
    } catch {
      secretPhrase = null;
    }
  }

  return (
    <RoomShellClient
      sidebarSecretPhrase={secretPhrase}
      showPushNotifyBanner={!!session}
      showAdminSidebarLink={session?.role === "admin"}
    >
      {children}
    </RoomShellClient>
  );
}
