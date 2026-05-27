const CACHE_NAME = "openbinder-static-__CACHE_VERSION__";

const PRECACHE_URLS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon-32x32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isCollectionsRoute(url) {
  return (
    url.pathname === "/collections" || url.pathname.startsWith("/collections/")
  );
}

function collectionsCacheRequest(pathname, kind) {
  return new Request(
    new URL(`${pathname}?__offline=${kind}`, self.location.origin).href,
  );
}

function requestKind(request) {
  if (request.headers.get("RSC") === "1") {
    return "rsc";
  }
  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    return "html";
  }
  return null;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function matchCollectionsCache(cache, pathname, kind) {
  if (kind === "rsc") {
    const rscCached = await cache.match(
      collectionsCacheRequest(pathname, "rsc"),
    );
    if (rscCached) {
      return rscCached;
    }
  }

  return cache.match(collectionsCacheRequest(pathname, "html"));
}

async function networkFirstCollections(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const kind = requestKind(request);
  const cache = await caches.open(CACHE_NAME);

  if (kind) {
    const cached = await matchCollectionsCache(cache, pathname, kind);
    if (cached) {
      // Serve cache before hitting the network. iOS Safari shows a native
      // offline error for failed document navigations even when a fallback exists.
      void fetch(request)
        .then(async (response) => {
          if (response.ok) {
            await cache.put(
              collectionsCacheRequest(pathname, kind),
              response.clone(),
            );
          }
        })
        .catch(() => {});
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok && kind) {
      await cache.put(collectionsCacheRequest(pathname, kind), response.clone());
    }
    return response;
  } catch (error) {
    const cached = await matchCollectionsCache(cache, pathname, kind);
    if (cached) {
      return cached;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/images/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/api/collection-covers/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isCollectionsRoute(url)) {
    event.respondWith(networkFirstCollections(request));
    return;
  }

  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (/\.(?:png|svg|json|woff2?|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
