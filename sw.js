// Build Believe Fit — Service Worker v9 — Masterpiece
// Background Sync + Offline Cache + Auto-flush on reconnect
//
// CACHE-BUMP CONVENTION: bump the version string below on any deploy that
// touches HTML/JS/CSS so the activate handler clears stale caches and
// users get fresh assets on next load. Strategy is stale-while-revalidate
// for GETs (POSTs bypass the SW entirely — see fetch handler below), so
// without a version bump, updates can take two page loads to propagate.
var CACHE = 'bbf-v40';
var CORE = ['/bbf-app.html', '/manifest.json', '/bbf-icon-192.jpg', '/bbf-icon-512.jpg', '/bbf-apple-touch-180.jpg', '/bbf-photo.jpg'];

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      return c.addAll(CORE);
    }).catch(function() {})
  );
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) {
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// ─── FETCH — Stale-While-Revalidate ──────────────────────────
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        }
        return response;
      }).catch(function() {
        return caches.match('/bbf-app.html');
      });
      return cached || networkFetch;
    })
  );
});

// ─── BACKGROUND SYNC ─────────────────────────────────────────
self.addEventListener('sync', function(e) {
  if (e.tag === 'bbf-workout-sync') {
    e.waitUntil(flushSyncQueue());
  }
});

function flushSyncQueue() {
  return self.clients.matchAll().then(function(clients) {
    if (!clients.length) return;
    clients.forEach(function(client) {
      client.postMessage({ type: 'BBF_SYNC_FLUSH' });
    });
  });
}

// ─── MESSAGE HANDLER ─────────────────────────────────────────
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
