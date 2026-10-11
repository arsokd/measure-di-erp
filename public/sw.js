// Deliberately does not cache anything. This app updates frequently for a
// live field team (see the no-cache headers in netlify.toml), so caching
// HTML/JS here would risk serving a stale version - exactly what those
// headers exist to prevent. This service worker exists purely to satisfy
// the browser's installability requirement for "Add to Home Screen" /
// standalone PWA mode; every request still goes straight to the network.
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  event.respondWith(fetch(event.request));
});
