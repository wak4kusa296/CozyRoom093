"use client";

import { useEffect, useRef } from "react";

type NotificationEventStreamOptions = {
  enabled: boolean;
  url: string;
  onEvent: () => void;
  onFallback: () => void;
};

const RETRY_DELAY_MS = 5_000;

/**
 * Opens one notification SSE stream and makes at most one quiet retry. The
 * caller's normal polling remains the durable fallback when streaming fails.
 */
export function useNotificationEventStream({
  enabled,
  url,
  onEvent,
  onFallback
}: NotificationEventStreamOptions) {
  const onEventRef = useRef(onEvent);
  const onFallbackRef = useRef(onFallback);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onFallbackRef.current = onFallback;
  }, [onFallback]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let retryUsed = false;
    let source: EventSource | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed) return;
      source = new EventSource(url);
      source.onmessage = () => onEventRef.current();
      source.onerror = () => {
        source?.close();
        if (!retryUsed) {
          retryUsed = true;
          retryTimer = setTimeout(connect, RETRY_DELAY_MS);
          return;
        }
        onFallbackRef.current();
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [enabled, url]);
}
