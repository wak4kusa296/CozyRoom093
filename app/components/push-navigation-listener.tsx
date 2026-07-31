"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Service Worker が既存ウィンドウを navigate() できない環境（iOS 等）向け。
 * 通知タップ時に sw.js から届くメッセージで、開いているページを目的地へ移動させる。
 */
export function PushNavigationListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data || data.type !== "notification-navigate" || !data.url) return;

      let target: URL;
      try {
        target = new URL(data.url, window.location.origin);
      } catch {
        return;
      }
      if (target.origin !== window.location.origin) return;
      if (target.href === window.location.href) return;

      router.push(`${target.pathname}${target.search}${target.hash}`);
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
