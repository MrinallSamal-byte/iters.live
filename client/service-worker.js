// Enhanced Service Worker for PWA with Advanced Caching Strategies
const CACHE_VERSION = 'v2';
const CACHE_NAME = `iter-edu-${CACHE_VERSION}`;
const RUNTIME_CACHE = `iter-runtime-${CACHE_VERSION}`;
const API_CACHE = `iter-api-${CACHE_VERSION}`;

// Static assets to precache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/css/style.css',
  '/css/animations.css',
  '/js/main.js',
  '/js/landing.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png'
];

// API endpoints that can be cached with stale-while-revalidate
const CACHEABLE_API_PATTERNS = [
  /\/api\/analytics\//,
  /\/api\/user\/profile/,
  /\/api\/timetable/,
  /\/api\/files\/list/,
  /\/api\/hostel\/menu/
];

// Max age for different cache types (in milliseconds)
const CACHE_MAX_AGE = {
  static: 7 * 24 * 60 * 60 * 1000,  // 7 days
  api: 5 * 60 * 1000,                 // 5 minutes
  runtime: 24 * 60 * 60 * 1000        // 1 day
};
const NON_CACHEABLE_HTML_PATHS = new Set([
  '/login',
  '/login.html',
  '/register',
  '/register.html',
  '/creator',
  '/creator.html',
  '/connect-portal',
  '/connect-portal.html',
  '/clear-session.html'
]);

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
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

// Helper function to check if API endpoint should be cached
function shouldCacheAPI(url) {
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Helper function to check cache freshness
async function isCacheFresh(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (!cachedResponse) return false;
  
  const cachedDate = cachedResponse.headers.get('sw-cache-date');
  if (!cachedDate) return false;
  
  const cacheAge = Date.now() - parseInt(cachedDate);
  return cacheAge < maxAge;
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  
  // Try to get from cache first
  const cachedResponse = await cache.match(request);
  
  // Fetch from network in background
  const fetchPromise = fetch(request).then(async (response) => {
    if (response.status === 200) {
      // Clone the response and add cache timestamp
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', Date.now().toString());
      
      const responseWithTimestamp = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      await cache.put(request, responseWithTimestamp);
    }
    return response;
  }).catch(() => null);
  
  // Return cached response immediately if fresh, otherwise wait for network
  if (cachedResponse && await isCacheFresh(request, cacheName, maxAge)) {
    // Return cached and update in background (fire-and-forget)
    // Intentionally not awaiting to allow background update
    fetchPromise.catch(() => {}); // Handle promise rejection silently
    return cachedResponse;
  }
  
  // Wait for network response
  const networkResponse = await fetchPromise;
  return networkResponse || cachedResponse || new Response(JSON.stringify({
    success: false,
    message: 'Network error - you are offline'
  }), {
    headers: { 'Content-Type': 'application/json' },
    status: 503
  });
}

// Fetch event - enhanced with multiple caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - stale-while-revalidate for cacheable endpoints
  if (url.pathname.startsWith('/api/')) {
    if (shouldCacheAPI(url)) {
      // Use stale-while-revalidate for cacheable API endpoints
      event.respondWith(
        staleWhileRevalidate(request, API_CACHE, CACHE_MAX_AGE.api)
      );
    } else {
      // Network only for other API requests (auth, mutations, etc.)
      event.respondWith(
        fetch(request).catch(() => {
          return new Response(JSON.stringify({
            success: false,
            message: 'Network error - you are offline'
          }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
      );
    }
    return;
  }

  // Static assets - cache first with network fallback
  if (PRECACHE_URLS.includes(url.pathname) || 
      url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|woff|woff2|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Check if cache is stale and update in background
          if (!isCacheFresh(request, CACHE_NAME, CACHE_MAX_AGE.static)) {
            fetch(request).then((response) => {
              if (response.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, response);
                });
              }
            }).catch(() => {});
          }
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return caches.open(RUNTIME_CACHE).then((cache) => {
          return fetch(request).then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => {
            // Return offline page for failed requests
            return caches.match('/index.html');
          });
        });
      })
    );
    return;
  }

  // HTML pages - network first with cache fallback
  if (request.mode === 'navigate' && NON_CACHEABLE_HTML_PATHS.has(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          return cachedResponse || caches.match('/index.html');
        });
      })
  );
});

// Background sync for offline uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-uploads') {
    event.waitUntil(syncUploads());
  }
});

async function syncUploads() {
  console.log('[SW] Syncing uploads...');
  // Implementation for syncing queued uploads when online
  const uploads = await getQueuedUploads();
  
  for (const upload of uploads) {
    try {
      await fetch('/api/files/upload', {
        method: 'POST',
        body: upload.data
      });
      await removeFromQueue(upload.id);
    } catch (error) {
      console.error('[SW] Failed to sync upload:', error);
    }
  }
}

async function getQueuedUploads() {
  // Get uploads from IndexedDB
  return [];
}

async function removeFromQueue(id) {
  // Remove from IndexedDB
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ITERasn hub';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-96.png',
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
