const BUILD_TAG = "20260413b";
const CACHE_KEY = `propertysetu-shell-${BUILD_TAG}`;
const SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/assets/icons/propertysetu-app-icon.svg",
  `/css/style.css?v=${BUILD_TAG}`,
  `/css/professional-folder.css?v=${BUILD_TAG}`,
  `/js/live-api.js?v=${BUILD_TAG}`,
  `/js/folder-command-dock.js?v=${BUILD_TAG}`,
  `/js/app-launch-readiness.js?v=${BUILD_TAG}`
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_KEY);
    await Promise.all(
      SHELL_FILES.map(async (resource) => {
        try {
          const response = await fetch(resource, { cache: "no-cache" });
          if (response.ok) {
            await cache.put(resource, response.clone());
          }
        } catch {
          // Ignore cache miss during install.
        }
      })
    );
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((cacheName) => cacheName !== CACHE_KEY)
        .map((cacheName) => caches.delete(cacheName))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const isNavigation = request.mode === "navigate";
  const isSameOrigin = new URL(request.url).origin === self.location.origin;
  if (!isSameOrigin) return;

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(request);
      const cache = await caches.open(CACHE_KEY);
      cache.put(request, networkResponse.clone()).catch(() => {});
      return networkResponse;
    } catch {
      const cache = await caches.open(CACHE_KEY);
      const cached = await cache.match(request);
      if (cached) return cached;
      if (isNavigation) {
        const fallback = await cache.match("/index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
