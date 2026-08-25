const CACHE_NAME = 'marketplace-premium-cache-v3';
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

    // ⚡ Strategy for STATIC FILES (JS, CSS): Network-First
    // Après un déploiement, le nouveau bundle est TOUJOURS chargé dès la
    // première requête (le cache ne sert qu'en fallback hors-ligne).
    // Fonts: Stale-While-Revalidate (jamais bloquantes, stables).
    if (request.destination === 'script' || request.destination === 'style') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return networkResponse;
                })
                .catch(() =>
                    caches.open(CACHE_NAME).then((cache) => cache.match(request))
                )
        );
        return;
    }

    if (request.destination === 'font') {
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
