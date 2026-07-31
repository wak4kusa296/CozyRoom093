import { getSession } from "@/lib/auth";
import { registerAdminNotificationPush } from "@/lib/notification-push";
import { createNotificationEventStream } from "@/lib/notification-sse";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  return createNotificationEventStream(registerAdminNotificationPush);
}
