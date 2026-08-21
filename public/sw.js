const CACHE_NAME = 'marketplace-premium-cache-v2';
const MAX_ENTRIES = 200;
const STATIC_ASSETS = [
    '/manifest.json',
];

// 🚀 INSTALL: Pre-cache critical assets (Simulate Cache Reserve)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching static assets (Reserve)...');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 🧹 ACTIVATE: Cleanup old caches + trim current cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ).then(() => caches.open(CACHE_NAME)).then(async (cache) => {
                const keys = await cache.keys();
                if (keys.length > MAX_ENTRIES) {
                    await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES).map((req) => cache.delete(req)));
                }
            });
        })
    );
    self.clients.claim();
});

// ⚡ FETCH: Strategy Manager (The Real "File Cache")
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 🛡️ Skip non-http/https requests (chrome-extension, blob, data, etc.)
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // 🛡️ Skip navigation requests - let them pass through without SW interception
    if (request.mode === 'navigate') {
        return;
    }

    // 🏎️ Strategy for IMAGES (File Cache)
    // Only cache GET requests for images (Supabase, external logos, etc.)
    if (request.method === 'GET' && (
        request.destination === 'image' || 
        url.href.includes('supabase.co/storage') ||
        url.hostname.includes('cloudinary.com') ||
        url.hostname.includes('googleusercontent.com')
    )) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    });

                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // ⚡ Strategy for STATIC FILES (JS, CSS, Fonts): Stale-While-Revalidate
    // Sert le cache instantanément mais rafraîchit en arrière-plan → jamais de vieux bundle bloqué après un déploiement.
    if (request.destination === 'font' || request.destination === 'script' || request.destination === 'style') {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 🌐 Default: Network Only
    return;
});
