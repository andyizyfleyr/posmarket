const CACHE_NAME = 'marketplace-premium-cache-v4';
const MAX_ENTRIES = 200;
const STATIC_ASSETS = [
    '/manifest.json',
    '/offline',
];

/**
 * Évince les entrées les plus anciennes quand le cache dépasse `MAX_ENTRIES`.
 * (L'éviction n'avait lieu qu'à l'activation : le cache pouvait grossir sans
 * limite entre deux déploiements.)
 */
function trimCache(cache) {
    return cache.keys()
        .then((keys) => {
            if (keys.length <= MAX_ENTRIES) return;
            return Promise.all(
                keys.slice(0, keys.length - MAX_ENTRIES).map((k) => cache.delete(k)),
            );
        })
        .catch(() => {});
}

/** Met une réponse en cache sans jamais rejeter (mises à jour en tâche de fond). */
function cacheResponse(cache, request, response) {
    if (!response || response.status !== 200) return Promise.resolve();
    return cache.put(request, response.clone())
        .then(() => trimCache(cache))
        .catch(() => {});
}

/**
 * Stale-While-Revalidate : on sert immédiatement la version en cache et on
 * rafraîchit derrière. Une image produit remplacée finit donc toujours par
 * s'afficher, même si le cache répond en premier.
 */
function staleWhileRevalidate(event, request) {
    const looked = caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => ({ cache, cached })),
    );

    const network = looked
        .then(({ cache }) =>
            fetch(request).then((response) => {
                cacheResponse(cache, request, response);
                return response;
            }),
        )
        .catch(() => undefined);

    event.respondWith(
        looked.then(({ cached }) =>
            cached || network.then((response) => response || Response.error()),
        ),
    );
    // Le rafraîchissement se poursuit même après la réponse servie à la page.
    event.waitUntil(network.then(() => undefined).catch(() => undefined));
}

// 🚀 INSTALL: Pre-cache critical assets (Simulate Cache Reserve)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            // Chaque ressource est pré-cachée indépendamment : l'échec d'une
            // seule (route en erreur, réseau coupé) ne doit pas faire échouer
            // l'installation du service worker.
            Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset))),
        ),
    );
    self.skipWaiting();
});

// 🧹 ACTIVATE: purge des anciens caches + éviction
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) =>
                Promise.all(
                    names
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => caches.delete(name)),
                ),
            )
            .then(() => caches.open(CACHE_NAME))
            .then((cache) => trimCache(cache))
            .catch(() => {}),
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

    // 🛡️ Navigation requests : réseau d'abord, page /offline en secours
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match('/offline').then((r) => r || Response.error())
            )
        );
        return;
    }

    // 🏎️ Strategy for IMAGES (File Cache) : stale-while-revalidate
    // Only cache GET requests for images (Supabase, external logos, etc.)
    if (request.method === 'GET' && (
        request.destination === 'image' || 
        url.href.includes('supabase.co/storage') ||
        url.hostname.includes('cloudinary.com') ||
        url.hostname.includes('googleusercontent.com')
    )) {
        staleWhileRevalidate(event, request);
        return;
    }

    // ⚡ Strategy for STATIC FILES (JS, CSS): Network-First
    // Après un déploiement, le nouveau bundle est TOUJOURS chargé dès la
    // première requête (le cache ne sert qu'en fallback hors-ligne).
    if (request.destination === 'script' || request.destination === 'style') {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches
                            .open(CACHE_NAME)
                            .then((cache) => cache.put(request, clone))
                            .catch(() => {});
                    }
                    return networkResponse;
                })
                .catch(() =>
                    caches
                        .open(CACHE_NAME)
                        .then((cache) => cache.match(request))
                        .then((cached) => cached || Response.error())
                        .catch(() => Response.error()),
                )
        );
        return;
    }

    // Police : stale-while-revalidate (jamais bloquante, stable).
    if (request.destination === 'font') {
        staleWhileRevalidate(event, request);
        return;
    }

    // 🌐 Default: Network Only
    return;
});

// 🔔 Push notifications
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'PosMarket';
    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            icon: data.icon || '/favicon.ico',
            badge: '/favicon.ico',
            data: { url: data.url || '/' },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(clients.openWindow(url));
});
