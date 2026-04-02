self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** インストール可能性の判定用に、ナビゲーションをそのままネットワークへ（オフラインキャッシュはしない） */
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
