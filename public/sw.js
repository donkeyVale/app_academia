self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

// Caché simple de GET del mismo origen
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Solo manejar peticiones HTTP(S) de nuestro propio origen.
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open('v1').then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const res = await fetch(event.request);
      if (res && res.status === 200) {
        cache.put(event.request, res.clone());
      }
      return res;
    })
  );
});

// Manejo de notificaciones push
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: 'Notificación', body: event.data.text() };
  }

  const title = payload.title || 'Notificación';
  const options = {
    body: payload.body || '',
    icon: '/icons/logoHome.png',
    badge: '/icons/logoHome.png',
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click en la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
