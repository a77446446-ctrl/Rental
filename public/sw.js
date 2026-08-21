const CACHE_VERSION = 'eco-gorniy-pwa-v51';
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/css/main.css?v=20260821-1',
  '/css/mobile-app.css?v=20260822-2',
  '/css/mobile-layout.css?v=20260821-4',
  '/js/api.js?v=20260821-1',
  '/js/pwa.js?v=20260811-2',
  '/js/chat.js?v=20260822-2',
  '/js/calendar.js?v=20260813-1',
  '/js/mobile-shell.js?v=20260821-1',
  '/js/admin-entry.js?v=20260813-1',
  '/js/main.js?v=20260821-6',
  '/js/lucide.min.js?v=20260811-2',
  '/icons/icon-512.png',
  '/icons/maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => {
        if (key !== CACHE_VERSION) return caches.delete(key);
        return Promise.resolve();
      })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Актуальный логотип из админки нужен на автономной заставке PWA.
  if (/^\/api\/(?:icon\.png|pwa-icon\/(?:192|512)\.png)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => (
          cached || caches.match(url.pathname.includes('/512.') ? '/icons/icon-512.png' : '/icons/icon-192.png')
        )))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) return;

  // Навигация — network-first, fallback на кэш
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => response)
        .catch(() => {
          if (url.pathname.startsWith('/admin/')) return Response.error();
          return caches.match('/index.html');
        })
    );
    return;
  }

  // JS и CSS файлы — всегда network-first (свежие при F5)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Остальные ресурсы (иконки, шрифты, изображения) — cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const clone = response.clone();
        if (response.ok) {
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
