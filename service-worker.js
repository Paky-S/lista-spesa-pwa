const CACHE_NAME = 'lista-spesa-cache-v7';

const ASSETS = [
  './',
  './index.html',
  './styles.v7.css',
  './app.v7.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))))
  );
  self.clients.claim();
});

function normalizeRequest(request) {
  const url = new URL(request.url);
  if (url.origin === location.origin && url.searchParams.has('v')) {
    url.searchParams.delete('v');
    return new Request(url.toString(), { method: request.method, headers: request.headers, mode: request.mode, credentials: request.credentials, redirect: request.redirect, referrer: request.referrer, referrerPolicy: request.referrerPolicy, integrity: request.integrity, cache: 'no-store' });
  }
  return request;
}

self.addEventListener('fetch', (event) => {
  const req = normalizeRequest(event.request);

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then((res) => {
        caches.open(CACHE_NAME).then((c) => c.put('./index.html', res.clone())).catch(()=>{});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        fetch(req).then((res) => { if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(req, res)).catch(()=>{}); }).catch(()=>{});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res.ok && req.method === 'GET') caches.open(CACHE_NAME).then((c) => c.put(req, res.clone())).catch(()=>{});
        return res;
      });
    })
  );
});
