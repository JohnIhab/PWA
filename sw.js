// Service Worker for Todo PWA
const CACHE_NAME = 'todo-pwa-v1.0.0';
const API_CACHE_NAME = 'todo-api-cache-v1.0.0';

// Static assets to cache
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/images.jpg'
];

// Install event - cache static assets
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

// Activate event - clean up old caches
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

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
    const requestURL = new URL(event.request.url);
    
    // Handle API requests with cache-first strategy for data
    if (requestURL.pathname.includes('/api/') || requestURL.hostname.includes('jsonplaceholder')) {
        event.respondWith(handleApiRequest(event.request));
        return;
    }
    
    // Handle static assets with cache-first strategy
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
                        
                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Handle API requests with caching
async function handleApiRequest(request) {
    const cache = await caches.open(API_CACHE_NAME);
    
    try {
        // Try network first
        console.log('Service Worker: Fetching API data from network');
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const responseToCache = networkResponse.clone();
            await cache.put(request, responseToCache);
            console.log('Service Worker: API data cached');
            
            // Notify client that we're online
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
    
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        console.log('Service Worker: Serving API data from cache');
        
        // Notify client that we're offline
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
    
    // Both network and cache failed
    throw new Error('No cached data available');
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync', event.tag);
    
    if (event.tag === 'sync-todos') {
        event.waitUntil(syncTodos());
    }
});

// Sync todos when back online
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

// Message handling from main app
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CHECK_NETWORK') {
        // Perform a network check
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
