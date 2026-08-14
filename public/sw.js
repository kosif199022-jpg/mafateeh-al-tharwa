const CACHE_NAME = "mafateeh-al-tharwa-v13";
const OFFLINE_FILES = [
  "/reader.html?v=13",
  "/reader-tools.css?v=13",
  "/reader-ambience.css?v=13",
  "/reader-studio.css?v=13",
  "/reader-formats.js?v=13",
  "/reader-tools.js?v=13",
  "/reader-ambience.js?v=13",
  "/reader-studio.js?v=13",
  "/backgrounds/ocean-dawn.webp",
  "/backgrounds/forest-mist.webp",
  "/backgrounds/desert-night.webp",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestURL = new URL(event.request.url);
  if (requestURL.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/reader.html?v=13")))
    );
    return;
  }

  // iOS requests streamed audio in byte ranges. When a full MP3 is cached,
  // synthesize a standards-compliant 206 response so offline seeking still works.
  if (event.request.headers.has("range")) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request.url);
      if (!cached) return fetch(event.request);
      const bytes = await cached.arrayBuffer();
      const match = /bytes=(\d*)-(\d*)/.exec(event.request.headers.get("range") || "");
      const start = Math.min(bytes.byteLength - 1, Math.max(0, +(match?.[1] || 0)));
      const requestedEnd = match?.[2] ? +match[2] : bytes.byteLength - 1;
      const end = Math.min(bytes.byteLength - 1, Math.max(start, requestedEnd));
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
          "Content-Length": String(end - start + 1),
          "Content-Type": cached.headers.get("Content-Type") || "audio/mpeg"
        }
      });
    })());
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ||
      fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
    )
  );
});
