/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute, setCatchHandler } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

// Precache all build assets (JS, CSS, images with hash names)
precacheAndRoute((self as any).__WB_MANIFEST)

// Navigation: always network — no stale cache served
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkOnly()
)

const OFFLINE_CACHE = 'offline-v1'
const OFFLINE_URL = '/offline.html'

// Cache offline.html at install time so it's always available
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then(cache => cache.add(OFFLINE_URL))
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
