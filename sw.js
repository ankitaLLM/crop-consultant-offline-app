// Versioned, scope-specific shell. Never cache arbitrary APIs, Google Maps, or other Pages apps.
const PREFIX = `terrasync-${encodeURIComponent(self.registration.scope)}-`;
const CACHE = `${PREFIX}v7`;
const CORE = [
  './',
  './index.html',
  './style.css?v=7',
  './src/config.js?v=7',
  './src/geo/geometry.js?v=7',
  './src/location/location-service.js?v=7',
  './src/maps/map-adapter.js?v=7',
  './src/maps/offline-field-adapter.js?v=7',
  './src/maps/google-map-adapter.js?v=7',
  './src/maps/map-controller.js?v=7',
  './src/db.js?v=7',
  './src/drafts.js?v=7',
  './src/app.js?v=7',
  './src/data.js',
  './manifest.json',
  './assets/icon.svg',
  './assets/offline-tile-placeholder.svg',
  './terms.html',
  './privacy.html'
];
const CORE_URLS = new Set(CORE.map(path => new URL(path, self.registration.scope).href));
const LEAFLET = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    // Third-party dependency failures do not block local drafts reopening.
    await Promise.allSettled(LEAFLET.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate' && url.href.startsWith(self.registration.scope);
  if (!isNavigation && !CORE_URLS.has(url.href) && !LEAFLET.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isNavigation) return await cache.match(new URL('./index.html', self.registration.scope)) || fetch(event.request);
    return await cache.match(event.request) || fetch(event.request);
  })());
});
