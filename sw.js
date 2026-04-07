// Build Believe Fit — Service Worker v3
// Caches core app files for offline use

var CACHE_NAME = 'bbf-cache-v3';
var CORE_FILES = [
  '/bbf-app.html',
  '/bbf-icon.jpeg',
  '/manifest.json'
];

// Install — cache core files
self.addEventListener('install', function(e) {
  console.log('[SW] Installing BBF Service Worker v3');
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CORE_FILES);
    }).catch(function(err) {
      console.log('[SW] Cache install error:', err);
    })
  );
  self.skipWaiting();
});

// Activate — delete old caches
self.addEventListener('activate', function(e) {
  console.log('[SW] Activating BBF Service Worker v3');
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', function(e) {
  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) {
        // Serve cached version, update cache in background
        var networkFetch = fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(e.request, copy);
            });
          }
          return response;
        }).catch(function() {});
        return cached;
      }
      // Not in cache — fetch from network
      return fetch(e.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, copy);
        });
        return response;
      }).catch(function() {
        // Offline fallback
        return caches.match('/bbf-app.html');
      });
    })
  );
});
