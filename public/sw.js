// v15 - stale-while-revalidate for static assets + dashboard/game HTML
//       cache-first (no revalidation) for /api/me
//       game page keyed by path only (query string ignored)
//       push notification support
const CACHE = 'fjwf-static-v15';

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

// On CLEAR_API_ME message: delete all /api/me entries (any query string)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_API_ME') {
    caches.open(CACHE).then(cache =>
      cache.keys().then(keys =>
        Promise.all(keys.filter(k => new URL(k.url).pathname === '/api/me').map(k => cache.delete(k)))
      )
    );
  }
});

function shouldCache(url) {
  if (url.origin !== self.location.origin) return false;
  // Static assets
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot)$/i.test(url.pathname)) return true;
  // Server-rendered pages (but not login)
  if (url.pathname === '/dashboard' || url.pathname === '/game') return true;
  // API
  if (url.pathname === '/api/me') return true;
  return false;
}

// For /game, use path-only as cache key so all ?id=... share one entry
function cacheKey(url) {
  if (url.pathname === '/game') return new Request(url.origin + url.pathname);
  return new Request(url.href);
}

// Stale-while-revalidate: serve from cache instantly, update cache in background
// Exception: /api/me is cache-first with no background revalidation
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!shouldCache(url)) return;

  const key = cacheKey(url);

  // /api/me: cache-first, no background revalidation
  if (url.pathname === '/api/me') {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(key);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(key, response.clone());
        return response;
      })
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(key);
      const networkFetch = fetch(request).then(response => {
        if (response.ok) cache.put(key, response.clone());
        return response;
      }).catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }
      return networkFetch;
    })
  );
});

// Push notification received
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Final Jeopardy!', {
      body: data.body || '',
      icon: data.icon || '/images/apple-touch-icon.png',
      data: { url: data.url || '/dashboard' },
    })
  );
});

// Notification tapped — open or focus the game/dashboard tab
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
