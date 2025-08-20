// This service worker will handle push events for Firebase Cloud Messaging and custom push notifications.
// It will be registered alongside the Angular service worker (ngsw-worker.js).

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  const title = data.title || 'Zaalvoetbal Doorn';
  const options = {
    body: data.body || 'Je hebt een nieuwe melding!',
    icon: 'icons/icon-192x192.png',
    badge: 'icons/icon-72x72.png',
    data: data.url ? { url: data.url } : {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
