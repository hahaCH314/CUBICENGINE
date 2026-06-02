const CACHE_NAME = 'mmc-studio-v1'
const STATIC_ASSETS = [
  '/',
  '/editor',
  '/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  // Only intercept same-origin requests to prevent cache poisoning
  // from cross-origin responses that we cannot verify.
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        // Only cache successful, same-origin, non-redirected responses.
        // 'basic' type guarantees same-origin; excludes opaque cross-origin
        // and error responses that could poison the cache.
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          !response.redirected
        ) {
          const cloned = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned))
        }
        return response
      }).catch(() => cached) // Fall back to cache on network failure

      return cached || networkFetch
    })
  )
})
