// A simple, no-op service worker that takes control of the page.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // You can add caching strategies here if needed.
  // For this simple app, a network-first approach is fine.
  event.respondWith(fetch(event.request));
});
