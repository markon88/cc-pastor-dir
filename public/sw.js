// Bump CACHE_NAME with every app version bump — changing this string is what
// tells the browser a new service worker exists and triggers an update install.
const CACHE_NAME = 'pastor-dir-v10.2.2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/version.js',
  '/js/app.js',
  '/js/ama-meetings.js',
  '/js/data-version.js',
  '/js/db.js',
  '/js/search.js',
  '/js/pastors.js',
  '/js/churches.js',
  '/js/ama.js',
  '/js/volunteers.js',
  '/js/detail.js',
  '/js/contacts.js',
  '/js/support.js',
  '/js/admin.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Allow the client to trigger skipWaiting manually (e.g. from an Update button)
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API routes and changelog go directly to the network — never cache these
  if (url.pathname.startsWith('/api/') || url.pathname === '/changelog.html') {
    e.respondWith(
      fetch(e.request).catch(() => new Response(null, { status: 503 }))
    );
    return;
  }

  // Cache-first for everything else
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
