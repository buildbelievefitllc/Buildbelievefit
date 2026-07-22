/* BP Tracker service worker.
 * 1. Offline app shell (cache-first navigations).
 * 2. Web Push listener — renders the reminder from send-bp-reminder.
 *
 * Bump CACHE on any change to shipped static assets so devices refresh. */
const CACHE = 'bp-tracker-v1'
const SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

// Navigations: network-first (fresh app), fall back to cached shell offline.
// Other GETs: cache-first with background fill (hashed Vite assets are immutable).
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(request, clone))
          }
          return res
        }),
    ),
  )
})

// ── Web Push ──────────────────────────────────────────────────────────────
function parsePush(data) {
  if (!data) return {}
  try {
    return data.json()
  } catch {
    return { body: data.text() }
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePush(event.data)
  const title = payload.title || 'Time to log your blood pressure! 🩺'
  const body = payload.body || 'Tap to record this reading.'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'bp-reminder',
      renotify: true,
      vibrate: [80, 40, 80],
      data: { url: '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) return client.focus()
        }
        return self.clients.openWindow(target)
      }),
  )
})
