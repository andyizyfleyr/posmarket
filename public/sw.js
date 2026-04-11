const CACHE_NAME = 'marketplace-premium-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/globals.css',
    '/manifest.json', // I'll create this later if needed
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

// 🧹 ACTIVATE: Cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// ⚡ FETCH: Strategy Manager (The Real "File Cache")
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 🛡️ Skip navigation requests - let them pass through without SW interception
    if (request.mode === 'navigate') {
        return; // Let the browser handle navigation normally
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
                    // Cache First + Background Update (Stale-While-Revalidate)
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => null);

                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // ⚡ Strategy for STATIC FILES (JS, CSS, Fonts)
    if (request.destination === 'font' || request.destination === 'script' || request.destination === 'style') {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                return cachedResponse || fetch(request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // 🌐 Default: Network Only (no caching for API calls)
    // Don't interfere with data fetching
    return;
});
