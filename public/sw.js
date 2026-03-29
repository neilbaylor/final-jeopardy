// v6 - stale-while-revalidate for static assets + dashboard/game HTML
// game page is cached by path only (query string ignored)
const CACHE = 'fjwf-static-v6';

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
  if (url.pathname === '/dashboard' || url.pathname === '/game') return true;
  return false;
}

// For /game, use path-only as cache key so all ?id=... share one entry
function cacheKey(url) {
  if (url.pathname === '/game') return new Request(url.origin + url.pathname);
  return new Request(url.href);
}

// Stale-while-revalidate: serve from cache instantly, update cache in background
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!shouldCache(url)) return;

  const key = cacheKey(url);

  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(key);
      const networkFetch = fetch(request).then(response => {
        if (response.ok) cache.put(key, response.clone());
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
