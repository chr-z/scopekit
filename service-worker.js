const CACHE_NAME = 'scopekit-v2';
const PRECACHE_URLS = [
  '/scopekit/',
  '/scopekit/index.html',
  '/scopekit/src/main.js',
  '/scopekit/locales/en.json',
  '/scopekit/locales/pt-BR.json',
  '/scopekit/manifest.json',
  '/scopekit/service-worker.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const currentCACHE = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (!currentCACHE.includes(key)) {
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      });
    })
  );
});