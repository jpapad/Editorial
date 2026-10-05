// Pagewright service worker: lets the app open and keep coloring with a
// shaky or missing connection (a class tablet on school Wi-Fi).
//   * /_next/static, fonts, icons: cache first (their URLs change when they do).
//   * pages: network first, the last copy when offline.
//   * everything else — /api, Supabase, other origins, non-GET — goes
//     straight to the network, never cached (private data, payments).
// Bump VERSION to drop old caches.
const VERSION = "v1";
const STATIC = `pw-static-${VERSION}`;
const PAGES = `pw-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE_URL, "/kids"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pw-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(?:woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) ?? (await caches.match(OFFLINE_URL)))
    );
  }
});
