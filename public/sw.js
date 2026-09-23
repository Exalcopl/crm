const CACHE_NAME = "exalco-tasks-v1";

// Zasoby do pre-cache (shell aplikacji)
const PRECACHE_URLS = [
  "/app",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  // Natychmiastowe przejęcie kontroli bez czekania na reload
  self.skipWaiting();

  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("[SW] Pre-cache częściowo nieudany:", err);
      });
    })
  );
});

self.addEventListener("activate", (e) => {
  // Usuń stare wersje cache
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Obsługuj tylko requesty w zakresie /app lub zasoby statyczne
  if (!url.pathname.startsWith("/app") && !url.pathname.startsWith("/_next")) {
    return;
  }

  // Strategia: Network First z fallbackiem do cache dla /app
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Zapisz do cache jeśli odpowiedź jest OK
        if (response && response.status === 200 && e.request.method === "GET") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback do cache gdy brak sieci
        return caches.match(e.request).then((cached) => {
          return cached || caches.match("/app");
        });
      })
  );
});
