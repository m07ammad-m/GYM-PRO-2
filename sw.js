const CACHE_VERSION = 'gym-pro-cache-v12';
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing, cache version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(RUNTIME_CACHE)
      .then(cache => {
        console.log('[SW] Precaching core assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Skip waiting for activation');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating, cleaning old caches');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== RUNTIME_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming all clients');
        return self.clients.claim();
      })
  );
});

const isAssetRequest = (request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  
  return (
    path.includes('/assets/') ||
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.woff') ||
    path.endsWith('.woff2') ||
    path.endsWith('.ttf') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.svg') ||
    path.endsWith('.ico')
  );
};

const isHTMLRequest = (request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const accept = request.headers.get('accept');
  
  return (
    accept && accept.includes('text/html') ||
    path === '/' ||
    path === '/index.html' ||
    path.endsWith('.html')
  );
};

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);
  
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  if (isHTMLRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then(response => {
            if (response) return response;
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  if (isAssetRequest(request)) {
    const url = new URL(request.url);

    // .js files need network-first during dev so cache doesn't serve stale ESM
    if (url.pathname.endsWith('.js')) {
      event.respondWith(
        fetch(request)
          .then(response => {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
            return response;
          })
          .catch(() => caches.match(request))
      );
      return;
    }

    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          return response;
        }
        
        return fetch(request).then(fetchResponse => {
          if (!fetchResponse || fetchResponse.status !== 200) {
            return fetchResponse;
          }
          
          const responseToCache = fetchResponse.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });
          
          return fetchResponse;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
  );
});
