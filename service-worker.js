// Versione build
const CACHE_NAME = 'lista-spesa-cache-v6';

// Asset statici da mettere in cache all'install
const ASSETS = [
  './',
  './index.html',
  './styles.v6.css',
  './app.v6.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Forza attivazione immediata su messaggio
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install: precache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: pulizia vecchie cache + claim
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Helper: normalizza richieste ignorando il query ?v=...
function normalizeRequest(request) {
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v');
      return new Request(url.toString(), { method: request.method, headers: request.headers, mode: request.mode, credentials: request.credentials, redirect: request.redirect, referrer: request.referrer, referrerPolicy: request.referrerPolicy, integrity: request.integrity, cache: 'no-store' });
    }
  }
  return request;
}

// Strategia:
// - Navigazioni (HTML): network-first con fallback a cache (index.html) per offline.
// - Altri asset: cache-first con revalidate in background.
self.addEventListener('fetch', (event) => {
  const req0 = event.request;
  const req = normalizeRequest(req0);

  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    // HTML: network first
    event.respondWith(
      fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put('./index.html', resClone)).catch(()=>{});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // statici: cache first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // aggiorna in background
        fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(req, res)).catch(()=>{});
        }).catch(()=>{});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res.ok && req.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(()=>{});
        }
        return res;
      });
    })
  );
});
