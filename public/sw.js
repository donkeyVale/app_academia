const CACHE_NAME = 'agendo-static-v2';
const STATIC_ALLOWLIST = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/logoHome.png',
  '/icons/LogoAgendo1024.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ALLOWLIST).catch(() => undefined);
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Caché PWA (evita cachear HTML/Next build para no quedar con assets viejos y romper la hidratación)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Solo manejar peticiones HTTP(S) de nuestro propio origen.
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== self.location.origin) {
    return;
  }

  // Nunca interceptar API, auth callbacks, etc.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navegaciones (HTML): network-first. Si falla, fallback al '/'
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch {
          const cached = await caches.match('/');
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // No cachear recursos de build de Next (pueden cambiar por deploy)
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // Cache-first SOLO para assets estáticos (icons, imágenes, etc)
  const isStaticAsset =
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.css');

  if (!isStaticAsset) {
    // Para el resto, dejamos pasar a red sin cachear.
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      try {
        const res = await fetch(event.request);
        if (res && res.status === 200) {
          cache.put(event.request, res.clone());
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })(),
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
    // Icono principal de la notificación: usamos el logoHome como pediste
    icon: '/icons/logoHome.png',
    // Badge pequeño: mantenemos un icono redondo de la PWA para que Android
    // lo pueda recortar mejor. Si siguiera viéndose gris, probaremos a usar
    // también logoHome aquí o un icono específico monocromo.
    badge: '/icons/icon-192.png',
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
