// v5 - stale-while-revalidate for static assets + dashboard HTML
const CACHE = 'fjwf-static-v5';

// Activate immediately without waiting for old tabs to close
self.addEventListener('install', () => self.skipWaiting());

// On activate: delete all old caches, then claim all open tabs
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function shouldCache(url) {
  if (url.origin !== self.location.origin) return false;
  // Static assets
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(url.pathname)) return true;
  // Server-rendered pages (but not login)
  if (url.pathname === '/dashboard') return true;
  return false;
}

// Stale-while-revalidate: serve from cache instantly, update cache in background
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!shouldCache(url)) return;

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => null);

      if (cached) {
        // Return cached immediately; keep SW alive to finish background update
        event.waitUntil(networkFetch);
        return cached;
      }
      // Nothing cached yet — wait for network and cache the result
      return networkFetch;
    })
  );
});
