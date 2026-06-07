// Build Believe Fit — Service Worker v9 — Masterpiece
// Background Sync + Offline Cache + Auto-flush on reconnect
//
// CACHE-BUMP CONVENTION: bump the version string below on any deploy that
// touches HTML/JS/CSS so the activate handler clears stale caches and
// users get fresh assets on next load.
//
// CACHING POLICY (Phase 22 hardening · Ana stale-weights smoke-test):
//   • Static same-origin assets (HTML/JS/CSS/images/icons/manifest)
//     → stale-while-revalidate · fast offline boot, fresh on next load.
//   • Dynamic API hosts (Supabase REST/functions, Render proxy /api/*,
//     PostgREST anywhere) → NEVER cached. Always go to network.
//
// The prior version cached ALL successful GETs, including PostgREST
// rows. That left clients pinned to stale workout sets / dietary
// fields / meal plans for the lifetime of the cache entry. Closed.
var CACHE = 'bbf-v234';
var CORE  = ['/bbf-app.html', '/manifest.json', '/bbf-icon-192.png', '/bbf-icon-512.png', '/bbf-apple-touch-180.jpg', '/bbf-photo.jpg'];

// Hosts that serve dynamic data — NEVER cache anything from these.
// Anything else (same-origin GET to GitHub Pages) gets the
// stale-while-revalidate treatment for fast offline boot.
var DYNAMIC_HOST_PATTERNS = [
  /\.supabase\.co$/i,                  // PostgREST + edge functions
  /\.supabase\.in$/i,                  // legacy region
  /buildbelievefit\.onrender\.com$/i,  // Render proxy /api/* + /ws/*
  /api\.elevenlabs\.io$/i,             // direct TTS calls (defensive)
  /api\.brevo\.com$/i,                 // direct mail (defensive)
  /generativelanguage\.googleapis/i,   // Gemini direct
];

function isDynamic(url) {
  try {
    var u = new URL(url);
    // Any path under /api/ from anywhere is dynamic (defensive).
    if (u.pathname.indexOf('/api/') === 0 || u.pathname.indexOf('/rest/v1/') === 0 ||
        u.pathname.indexOf('/functions/v1/') === 0 || u.pathname.indexOf('/rpc/') === 0) {
      return true;
    }
    for (var i = 0; i < DYNAMIC_HOST_PATTERNS.length; i++) {
      if (DYNAMIC_HOST_PATTERNS[i].test(u.hostname)) return true;
    }
    return false;
  } catch (_) { return false; }
}

// ─── INSTALL ─────────────────────────────────────────────────
// v227 fix: the app shell (bbf-app.html + manifest) is fetched NETWORK-FIRST
// at install with cache:'reload', so a version bump can never seed the new
// cache with a stale shell from the HTTP/SW cache. Without this, the prior
// stale-while-revalidate fetch handler would serve the OLD bbf-app.html on the
// first load after a deploy — which is exactly why the AI Studio nav button +
// #tp-studio pane appeared "missing" on the live floor even though the markup
// was correct and the cache key had bumped.
var SHELL = ['/bbf-app.html', '/manifest.json'];
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Force-revalidate the shell against the network (bypass HTTP cache),
      // then add the remaining core assets best-effort.
      var shellFresh = Promise.all(SHELL.map(function(url) {
        return fetch(new Request(url, { cache: 'reload' }))
          .then(function(res) { if (res && res.ok) return c.put(url, res.clone()); })
          .catch(function() {});
      }));
      var restCached = c.addAll(CORE.filter(function(u) { return SHELL.indexOf(u) === -1; })).catch(function() {});
      return Promise.all([shellFresh, restCached]);
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
    }).then(function() {
      // Phase 22 cache-policy upgrade · also evict any previously-cached
      // dynamic responses that the OLD policy stored in the current
      // cache. Without this, clients upgrading from v205 → v206 would
      // still see stale PostgREST data until the next cache-key bump.
      return caches.open(CACHE).then(function(c) {
        return c.keys().then(function(reqs) {
          return Promise.all(reqs.map(function(req) {
            if (isDynamic(req.url)) return c.delete(req);
            return null;
          }));
        });
      });
    })
  );
  self.clients.claim();
});

// ─── FETCH ───────────────────────────────────────────────────
// Two paths:
//   1. DYNAMIC requests · network-only · NEVER cached
//   2. Static GET · stale-while-revalidate as before
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;       // POSTs bypass · writes go direct
  if (isDynamic(e.request.url)) return;         // dynamic GETs bypass · always fresh

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
