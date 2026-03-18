const APP_SHELL_CACHE = "shopnshop-shell-v3";
const HTML_NAVIGATION_FALLBACKS = new Set(["/", "/index.html", "/login.html", "/workspace.html"]);
const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/login.html",
  "/workspace.html",
  "/styles.css",
  "/main.js",
  "/login.js",
  "/workspace.js",
  "/pwa.js",
  "/manifest.webmanifest",
  "/icons/app-icon.svg",
  "/icons/app-icon-maskable.svg",
];
const NETWORK_FIRST_FILES = new Set([
  "/",
  "/index.html",
  "/login.html",
  "/workspace.html",
  "/styles.css",
  "/main.js",
  "/login.js",
  "/workspace.js",
  "/pwa.js",
  "/manifest.webmanifest",
  "/sw.js",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== APP_SHELL_CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  const isHtmlRequest = request.mode === "navigate" || HTML_NAVIGATION_FALLBACKS.has(url.pathname);
  const isNetworkFirstRequest = isHtmlRequest || NETWORK_FIRST_FILES.has(url.pathname);

  if (isNetworkFirstRequest) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          if (isHtmlRequest) {
            return caches.match("/workspace.html") || caches.match("/index.html");
          }
          throw new Error("asset_unavailable");
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    }),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "재고 알림";
  const options = {
    body: payload.body || "새 알림이 도착했습니다.",
    data: {
      url: payload.url || "/",
      categoryId: payload.categoryId || "",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
