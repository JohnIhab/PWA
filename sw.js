const CACHE_NAME = 'todo-pwa-v1.0.0';
const API_CACHE_NAME = 'todo-api-cache-v1.0.0';

const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/images.jpg'
];

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

self.addEventListener('fetch', (event) => {
    const requestURL = new URL(event.request.url);
    
    if (requestURL.pathname.includes('/api/') || requestURL.hostname.includes('jsonplaceholder')) {
        event.respondWith(handleApiRequest(event.request));
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    console.log('Service Worker: Serving from cache', event.request.url);
                    return cachedResponse;
                }
                
                console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch((error) => {
                        console.error('Service Worker: Network fetch failed', error);
                        
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

async function handleApiRequest(request) {
    const cache = await caches.open(API_CACHE_NAME);
    
    try {
        console.log('Service Worker: Fetching API data from network');
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            console.log('Service Worker: API data cached');
            
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'NETWORK_STATUS',
                        online: true
                    });
                });
            });
            
            return networkResponse;
        }
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache');
    }
    
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        console.log('Service Worker: Serving API data from cache');
        
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'NETWORK_STATUS',
                    online: false
                });
            });
        });
        
        return cachedResponse;
    }
    
    throw new Error('No cached data available');
}

self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync', event.tag);
    
    if (event.tag === 'sync-todos') {
        event.waitUntil(syncTodos());
    }
});

async function syncTodos() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_TODOS'
            });
        });
    } catch (error) {
        console.error('Service Worker: Sync failed', error);
    }
}

self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CHECK_NETWORK') {
        fetch('https://jsonplaceholder.typicode.com/posts/1')
            .then(() => {
                event.ports[0].postMessage({ online: true });
            })
            .catch(() => {
                event.ports[0].postMessage({ online: false });
            });
    }
});

console.log('Service Worker: Script loaded');
