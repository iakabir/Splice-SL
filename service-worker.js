// Splice SL — service worker
// Strategy while you're iterating on the interface:
//  - App shell (HTML/manifest): network-first, so edits you make show up
//    the next time the app is opened, with a cache fallback for offline use.
//  - Icons: cache-first, since they rarely change.
//
// Bump CACHE_VERSION any time you want to force everyone's cache to refresh.
const CACHE_VERSION = 'splice-sl-v1';

const APP_SHELL = [
  './shot-log.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests for our own origin's app shell files.
  if (req.method !== 'GET') return;

  const isAppShell =
    req.mode === 'navigate' ||
    APP_SHELL.some((path) => req.url.endsWith(path.replace('./', '')));

  if (isAppShell) {
    // Network-first: always try to get the freshest version while testing.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./shot-log.html')))
    );
    return;
  }

  // Everything else (fonts, JSZip from cdn, etc.): cache-first, fall back to network.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  );
});
