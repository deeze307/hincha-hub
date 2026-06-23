/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { NetworkOnly, CacheFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

// Precache all build assets (JS, CSS, images with hash names)
precacheAndRoute((self as any).__WB_MANIFEST)

const OFFLINE_CACHE = 'offline-v1'
const OFFLINE_URL = '/offline.html'

// Íconos de las notificaciones: deben estar SIEMPRE disponibles (incluso offline),
// porque el SO los pide al renderizar el push y, si fallan, muestra un fallback feo.
const NOTIF_ASSETS = ['/icon-192.png', '/badge-96.png']

// Servir los íconos de notificación desde caché (CacheFirst) para que nunca falten
registerRoute(
  ({ url }) => NOTIF_ASSETS.includes(url.pathname),
  new CacheFirst({ cacheName: OFFLINE_CACHE }),
)

// Navigation: always network — no stale cache served
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkOnly()
)

// Cachear offline.html + íconos de notificación al instalar
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(cache =>
      Promise.allSettled([OFFLINE_URL, ...NOTIF_ASSETS].map(u => cache.add(u)))
    )
  )
})

// Serve offline.html when any navigation request fails (no network)
setCatchHandler(async ({ request }: { request: Request }) => {
  if (request.destination === 'document') {
    const cache = await caches.open(OFFLINE_CACHE)
    return (await cache.match(OFFLINE_URL)) ?? new Response('Offline', { status: 503 })
  }
  return Response.error()
})

// ── Push notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  const { title, body, url } = event.data.json() as {
    title: string; body: string; url?: string
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
