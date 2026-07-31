self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * ナビゲーションはフックしない（fetch で document を渡すと、iOS Safari で
 * 「このページを読み込めません」やリダイレクト不具合が出ることがある）。
 * Push のみ利用。オフラインキャッシュはしない。
 */

self.addEventListener("push", (event) => {
  let data = { title: "誰も知らない部屋", body: "", url: "/room" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || "静かな便りが届きました。",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/room" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url ? event.notification.data.url : "/room";
  let url;
  try {
    url = new URL(raw, self.location.origin).href;
  } catch {
    url = new URL("/room", self.location.origin).href;
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = clientList.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      const already = sameOrigin.find((client) => client.url === url);
      if (already) {
        await already.focus();
        return;
      }

      /*
       * 既存ウィンドウは focus だけだと元のページ（PWA の start_url など）のまま残る。
       * navigate() が使えない環境（iOS 等）は postMessage でクライアント側に遷移させる。
       */
      for (const client of sameOrigin) {
        try {
          if (client.navigate) {
            const navigated = await client.navigate(url);
            if (navigated) {
              await navigated.focus();
              return;
            }
          }
        } catch {
          /* navigate() 不可 */
        }
        if ("focus" in client) {
          await client.focus();
          client.postMessage({ type: "notification-navigate", url });
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })()
  );
});
