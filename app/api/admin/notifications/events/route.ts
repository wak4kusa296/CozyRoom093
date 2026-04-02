import { getSession } from "@/lib/auth";
import { registerAdminNotificationPush } from "@/lib/notification-push";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const push = () => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: {"r":1}\n\n`));
        } catch {
          cleanup?.();
        }
      };

      const unsubscribe = registerAdminNotificationPush(push);

      try {
        controller.enqueue(encoder.encode(`data: {"r":1}\n\n`));
      } catch {
        unsubscribe();
        safeClose();
        return;
      }

      const interval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`:keepalive\n\n`));
        } catch {
          cleanup?.();
        }
      }, 25000);

      cleanup = () => {
        clearInterval(interval);
        unsubscribe();
        safeClose();
      };
    },
    cancel() {
      cleanup?.();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
