const swUrl = new URL(self.location.href);
const cacheVersion = swUrl.searchParams.get("v") || "dev";

const SHELL_CACHE = `hyoka-shell-${cacheVersion}`;
const STATIC_CACHE = `hyoka-static-${cacheVersion}`;

const SHELL_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const validCaches = new Set([SHELL_CACHE, STATIC_CACHE]);

    await Promise.all(
      keys
        .filter((key) => (key.startsWith("hyoka-shell-") || key.startsWith("hyoka-static-")) && !validCaches.has(key))
        .map((key) => caches.delete(key)),
    );

    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAssetRequest(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function isStaticAssetRequest(pathname) {
  if (pathname.startsWith("/_next/static/")) {
    return true;
  }

  if (pathname.startsWith("/icons/")) {
    return true;
  }

  return /\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)$/i.test(pathname);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    const offlineFallback = await cache.match("/offline.html");
    if (offlineFallback) {
      return offlineFallback;
    }

    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }

  const networkResponse = await networkPromise;
  return networkResponse || new Response("Not available", { status: 504, statusText: "Gateway Timeout" });
}
