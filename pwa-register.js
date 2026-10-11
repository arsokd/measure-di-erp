// Registers the installability service worker (see public/sw.js, served at
// the site root as /sw.js) on every page, including the pre-login pages
// that don't load auth-guard.js. Safe to call repeatedly; the browser
// no-ops if a matching registration already exists.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(err) {
      console.warn('Service worker registration failed:', err);
    });
  });
}
