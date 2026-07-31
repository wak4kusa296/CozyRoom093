type NotificationListener = () => void;
type SubscribeToNotifications = (listener: NotificationListener) => () => void;

const KEEPALIVE_MS = 25_000;
const EVENT_DATA = new TextEncoder().encode('data: {"r":1}\n\n');
const KEEPALIVE_DATA = new TextEncoder().encode(":keepalive\n\n");

/**
 * Produces the common authenticated-notification SSE response. Authentication
 * stays in the route, so each feed retains its existing authorization rules.
 */
export function createNotificationEventStream(subscribe: SubscribeToNotifications): Response {
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // The browser can cancel before the stream finishes closing.
        }
      };
      const send = (message: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(message);
        } catch {
          cleanup?.();
        }
      };
      const unsubscribe = subscribe(() => send(EVENT_DATA));
      const interval = setInterval(() => send(KEEPALIVE_DATA), KEEPALIVE_MS);

      cleanup = () => {
        clearInterval(interval);
        unsubscribe();
        close();
      };
      send(EVENT_DATA);
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
