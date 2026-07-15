importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'TY Gestion 2.0.1';
const urlsToCache = [
  '/PRESUPUESTO-2.0/',
  '/PRESUPUESTO-2.0/index.html',
  '/PRESUPUESTO-2.0/manifest.json',
  '/PRESUPUESTO-2.0/css/style.css',
  '/PRESUPUESTO-2.0/css/forms.css',
  '/PRESUPUESTO-2.0/css/dashboard.css',
  '/PRESUPUESTO-2.0/css/responsive.css',
  '/PRESUPUESTO-2.0/js/utils.js',
  '/PRESUPUESTO-2.0/js/storage.js',
  '/PRESUPUESTO-2.0/js/sync.js',
  '/PRESUPUESTO-2.0/js/charts.js',
  '/PRESUPUESTO-2.0/js/notifications.js',
  '/PRESUPUESTO-2.0/js/reports.js',
  '/PRESUPUESTO-2.0/js/ui.js',
  '/PRESUPUESTO-2.0/js/app.js',
  '/PRESUPUESTO-2.0/assets/img/icon-192.png',
  '/PRESUPUESTO-2.0/assets/img/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js'
];
// ... el resto del SW igual

// Instalación: cachear recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activar: limpiar cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  clients.claim();
});

// Fetch: estrategia "network first, cache fallback"
self.addEventListener('fetch', event => {
  // No cachear llamadas a Firebase
  if (event.request.url.includes('firebase') || event.request.url.includes('googleapis')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar y guardar en caché
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en caché
        return caches.match(event.request);
      })
  );
});
