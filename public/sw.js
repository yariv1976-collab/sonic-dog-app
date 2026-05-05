const CACHE_NAME = 'sonic-v1';
const ASSETS = ['/', '/index.html', '/app.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  const { title, body, waUrl } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      tag: 'sonic-' + Date.now(),
      data: { waUrl },
      actions: [
        { action: 'open-wa', title: '📱 פתח וואטסאפ' },
        { action: 'dismiss', title: 'סגור' }
      ],
      requireInteraction: true,
      dir: 'rtl',
      lang: 'he'
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const waUrl = e.notification.data?.waUrl;

  if (e.action === 'open-wa' || !e.action) {
    if (waUrl) {
      e.waitUntil(clients.openWindow(waUrl));
    }
  }
});
