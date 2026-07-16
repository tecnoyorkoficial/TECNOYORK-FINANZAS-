const CACHE_NAME = 'TY FINANZAS 2.0.0';
const urlsToCache = [
  '/TECNOYORK-FINANZAS-/',
  '/TECNOYORK-FINANZAS-/index.html',
  '/TECNOYORK-FINANZAS-/manifest.json',
  '/TECNOYORK-FINANZAS-/css/style.css',
  '/TECNOYORK-FINANZAS-/css/forms.css',
  '/TECNOYORK-FINANZAS-/css/dashboard.css',
  '/TECNOYORK-FINANZAS-/css/responsive.css',
  '/TECNOYORK-FINANZAS-/js/utils.js',
  '/TECNOYORK-FINANZAS-/js/storage.js',
  '/TECNOYORK-FINANZAS-/js/sync.js',
  '/TECNOYORK-FINANZAS-/js/charts.js',
  '/TECNOYORK-FINANZAS-/js/notifications.js',
  '/TECNOYORK-FINANZAS-/js/reports.js',
  '/TECNOYORK-FINANZAS-/js/ui.js',
  '/TECNOYORK-FINANZAS-/js/app.js',
  '/TECNOYORK-FINANZAS-/assets/img/icon-192.png',
  '/TECNOYORK-FINANZAS-/assets/img/icon-512.png',
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
