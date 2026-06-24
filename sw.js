// PhD Planner Service Worker
// Caches the app shell for offline use; calendar data fetched live when online

const CACHE = 'weekly-planner-v5';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL.map(u => {
      // Use cache-busting for html to always get fresh shell on reinstall
      return new Request(u, { cache: 'reload' });
    }))).catch(() => {
      // Silently fail if icons don't exist yet — non-fatal
      return caches.open(CACHE).then(c => c.add('./index.html'));
    })
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Google Calendar API calls: network only (need live data, no point caching)
// - Google OAuth: network only
// - Everything else: cache first, fall back to network
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Pass through auth and calendar API calls
  if (url.includes('googleapis.com') || url.includes('accounts.google.com') || url.includes('api.anthropic.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // App shell: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful same-origin responses
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
