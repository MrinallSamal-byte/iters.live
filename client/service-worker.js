// ITERasn hub service worker — offline-first caching strategies
const CACHE_VERSION = 'v5';
const CACHE_NAME = `iter-core-${CACHE_VERSION}`;
const RUNTIME_CACHE = `iter-runtime-${CACHE_VERSION}`;
const RUNTIME_MAX_ENTRIES = 200;

// Every path below was verified to exist under client/ and be served by Express:
// '/', '/manifest.json', '/assets/*', '/css/*', '/js/*' all map to client/ files.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/assets/icon.png',
  '/assets/soa-logo.png',
  '/css/style.css',
  '/css/home-minimal.css',
  '/css/mobile.css',
  '/js/main.js',
  '/js/landing.js',
  '/js/mobile-fixes.js',
  '/js/toast.js'
];

const STATIC_ASSET_RE = /\.(css|js|mjs|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot)$/i;

const OFFLINE_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<title>ITERasn hub — Offline</title><style>' +
  'html,body{margin:0;height:100%}' +
  'body{display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#eaeaea;' +
  'font-family:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;text-align:center;padding:24px;box-sizing:border-box}' +
  '.dot{width:10px;height:10px;border-radius:50%;background:#ff5a4f;margin:0 auto 18px;animation:pulse 1.6s ease-in-out infinite}' +
  '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}' +
  'p{font-size:13px;line-height:1.7;letter-spacing:.08em;text-transform:uppercase;margin:0}' +
  '</style></head><body><div><div class="dot"></div>' +
  "<p>OFFLINE — showing cached content isn't available for this page yet</p></div></body></html>";

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith('iter-') && !currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (!event.data || event.data.type !== 'CLEAR_APP_CACHE') {
    return;
  }

  const clearPromise = caches.keys().then((cacheNames) => Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('iter-'))
      .map((cacheName) => caches.delete(cacheName))
  ));

  if (typeof event.waitUntil === 'function') {
    event.waitUntil(clearPromise);
  }
});

async function pruneCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone())
        .then(() => pruneCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES))
        .catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function handleApiGet(request) {
  try {
    return await fetch(request);
  } catch (err) {
    return new Response(JSON.stringify({ success: false, offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const network = fetch(request).then(async (response) => {
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
      await pruneCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES);
    }
    return response;
  }).catch(() => null);

  if (cached) {
    network.catch(() => {});
    return cached;
  }

  const fresh = await network;
  if (fresh) return fresh;
  return new Response('', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept or cache non-GET traffic.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin requests.
  if (url.origin !== location.origin) return;

  // Navigation requests: network-first, cached match, branded offline page.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Same-origin API reads: network-first; responses are never cached.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiGet(request));
    return;
  }

  // Static assets (css/js/img/fonts): stale-while-revalidate.
  if (STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Push notifications (only existing icon assets referenced).
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ITERasn hub';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/assets/icon.png',
    badge: '/assets/icon.png',
    vibrate: [200, 100, 200],
    data: data.url || '/',
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});

console.log('[SW] Service worker loaded');
