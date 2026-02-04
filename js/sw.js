/* Service Worker simples: cache-first para assets estáticos */
const CACHE = 'rpn12c-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if(cached) return cached;

    try{
      const fresh = await fetch(req);
      // cache only same-origin
      const url = new URL(req.url);
      if(url.origin === self.location.origin){
        cache.put(req, fresh.clone());
      }
      return fresh;
    }catch(err){
      // fallback básico
      if(req.mode === 'navigate') return cache.match('./index.html');
      throw err;
    }
  })());
});
