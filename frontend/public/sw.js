// Build Believe Fit — React SPA Service Worker v1
// ─────────────────────────────────────────────────────────────────────────────
// Gives the React build a true standalone PWA: offline boot + fast asset loads,
// while NEVER caching dynamic data (Supabase / Render proxy / any /api).
//
// CACHE-BUMP CONVENTION: bump CACHE on any deploy that changes the app shell so
// the activate handler purges stale caches. (Vite fingerprints /assets/* with
// content hashes, so those are safe to cache aggressively; the navigation shell
// is what needs the bump.)
//
// CACHING POLICY (ported from the legacy SW, Phase 22 hardening):
//   • Navigations (SPA routes) → network-first, fall back to cached shell ("/").
//   • Static same-origin assets (JS/CSS/images/icons/fonts/manifest)
//     → stale-while-revalidate.
//   • Dynamic hosts (Supabase REST/functions, Render proxy /api/*, PostgREST,
//     direct AI/mail) → NEVER cached. Always network. Prevents clients getting
//     pinned to stale workout sets / meal plans / dietary fields.
var CACHE = 'bbf-react-v260';
var SHELL = '/';
var CORE = [
  '/',
  '/manifest.webmanifest',
  '/media/bbf-icon-192.png',
  '/media/bbf-icon-512.png',
  '/media/bbf-icon-maskable-512.png',
  '/media/bbf-apple-touch-180.jpg',
];

// Hosts that serve dynamic data — NEVER cache anything from these.
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
    if (u.pathname.indexOf('/api/') === 0 || u.pathname.indexOf('/rest/v1/') === 0 ||
        u.pathname.indexOf('/functions/v1/') === 0 || u.pathname.indexOf('/rpc/') === 0) {
      return true;
    }
    for (var i = 0; i < DYNAMIC_HOST_PATTERNS.length; i++) {
      if (DYNAMIC_HOST_PATTERNS[i].test(u.hostname)) return true;
    }
    return false;
  } catch { return false; }
}

// ─── MARKETING MEDIA STREAM EXEMPTION ────────────────────────
// Supabase Storage serves the marketing clips as chunked HTTP 206 Partial Content
// (video byte-range streaming). The SW must NEVER intercept, buffer, or cache these:
//   • cache.put() of a 206 partial response throws → rejects the respondWith chain
//     → media panic + broken seeking on the client.
//   • Buffering large mp4 chunks into Cache Storage saturates the worker thread.
// So we bail on (a) any Range request, and (b) the public marketing videos path —
// both go straight to the browser's native media loader, untouched by the worker.
function isMediaStream(req) {
  try {
    if (req.headers && req.headers.get('range')) return true;   // 206 byte-range stream
    var p = new URL(req.url).pathname;
    return p.indexOf('/storage/v1/object/public/videos/marketing/') !== -1;
  } catch { return false; }
}

// ─── INSTALL ─────────────────────────────────────────────────
// Fetch the shell network-first (cache:'reload') so a version bump can never
// seed the new cache with a stale index.html; add the rest of CORE best-effort.
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      var shellFresh = fetch(new Request(SHELL, { cache: 'reload' }))
        .then(function (res) { if (res && res.ok) return c.put(SHELL, res.clone()); })
        .catch(function () {});
      var restCached = c.addAll(CORE.filter(function (u) { return u !== SHELL; })).catch(function () {});
      return Promise.all([shellFresh, restCached]);
    }).catch(function () {})
  );
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                 // never cache mutations
  if (isMediaStream(req)) return;                   // 206 video streams → native loader, never buffered
  if (isDynamic(req.url)) return;                   // dynamic data → straight to network

  // SPA navigations → network-first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(SHELL, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(SHELL).then(function (m) { return m || caches.match(req); });
      })
    );
    return;
  }

  // Static same-origin assets → stale-while-revalidate.
  var sameOrigin = req.url.indexOf(self.location.origin) === 0;
  if (!sameOrigin) return;
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
