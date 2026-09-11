const CACHE_NAME = 'terrasync-cache-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './src/db.js',
  './src/data.js',
  './src/app.js',
  './manifest.json',
  './assets/icon.svg',
  './assets/offline-tile-placeholder.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'
];

// Install Service Worker and cache resources
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell & dependencies');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch resources: Cache-First strategy with Network fallback
self.addEventListener('fetch', (e) => {
  // Only cache GET requests and skip browser extensions or other protocols
  if (e.request.method !== 'GET' || (!e.request.url.startsWith(self.location.origin) && !e.request.url.startsWith('https://'))) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate: return cache, update in background
        fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
            }
          })
          .catch(() => {/* Ignore network failures when updating cache in background */});
        return cachedResponse;
      }

      // If not cached, fetch from network
      return fetch(e.request)
        .then((networkResponse) => {
          // Cache the new resource dynamically if valid
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and OSM map tile is requested, return a placeholder
          if (e.request.url.includes('tile.openstreetmap.org')) {
            return caches.match('./assets/offline-tile-placeholder.svg');
          }
          console.log('[Service Worker] Fetch failed, resource offline:', e.request.url);
        });
    })
  );
});
