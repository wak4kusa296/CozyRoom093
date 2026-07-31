import { getSessionOrRevokeIfGuestInactive } from "@/lib/auth";
import { registerRoomNotificationPush } from "@/lib/notification-push";
import { createNotificationEventStream } from "@/lib/notification-sse";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSessionOrRevokeIfGuestInactive();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const guestId = session.guestId;
  return createNotificationEventStream((listener) => registerRoomNotificationPush(guestId, listener));
}
