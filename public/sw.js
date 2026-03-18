const CACHE_NAME = 'fjwf-v2';

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/game',
  '/manifest.json',
  '/js/no-swipe-nav.js',
  '/js/player-cards.js',
  '/images/favicon.ico',
  '/images/favicon-16x16.png',
  '/images/favicon-32x32.png',
  '/images/apple-touch-icon.png',
  '/images/hone-screen-new.png',
  '/images/google-icon.svg',
  '/images/fjwf_logo.svg',
  '/images/fjwf_logo.webp',
  '/images/fjwf_logo_compressed.png',
  '/images/header-resized.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never intercept these API endpoints — always go to network
  if (url.pathname === '/api/games' || url.pathname === '/api/me') return;

  // Navigation requests: network-first, fall back to cached '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets: cache-first, fall back to network and cache the response
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
