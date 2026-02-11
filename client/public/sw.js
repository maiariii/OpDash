const CACHE_NAME = 'opdash-v1';
const URLS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/vite.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Strategy: Network First for API, Stale-While-Revalidate for others
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone and cache the response if needed, but for API usually we just return fresh
                    // Or we can cache it for offline fallback
                    return response;
                })
                .catch(() => {
                    // Fallback for API calls if offline could go here
                    return new Response(JSON.stringify({ error: 'Offline' }), { headers: { 'Content-Type': 'application/json' } });
                })
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - return response
                    if (response) {
                        return response;
                    }
                    return fetch(event.request);
                })
        );
    }
});
