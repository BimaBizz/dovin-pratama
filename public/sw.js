self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Keep requests working online while satisfying installability checks.
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
