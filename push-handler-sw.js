// This service worker handles generic Web Push notifications (VAPID) and in-app messaging.
// It is loaded alongside Angular's ngsw-worker.js via importScripts.

console.log('🚀 Push handler service worker loaded');

// Lifecycle events for proper service worker management
self.addEventListener('install', function(event) {
  console.log('🔧 Push handler: install event');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('✅ Push handler: activate event');
  // Claim all clients immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  console.log('🔔 Service Worker: Push event received!', event);
  console.log('📋 Event details:', {
    origin: event.origin,
    lastEventId: event.lastEventId,
    data: event.data ? event.data.text() : 'No data',
    registration: self.registration ? 'Available' : 'Not available'
  });
  
  let data = {};
  if (event.data) {
    try {
      console.log('📦 Push data:', event.data.text());
      data = event.data.json();
      console.log('✅ Parsed push data:', data);
    } catch (e) {
      console.error('❌ Failed to parse push data:', e);
      // Safely attempt to get text, with fallback
      try {
        const textData = event.data.text();
        data = { title: 'Zaalvoetbal Doorn', body: textData };
      } catch (textError) {
        console.error('❌ Failed to get text from push data:', textError);
        data = { title: 'Zaalvoetbal Doorn', body: 'Je hebt een nieuwe melding!' };
      }
    }
  } else {
    console.log('⚠️ No push data received, using default');
    data = { title: 'Zaalvoetbal Doorn', body: 'Test notificatie zonder data' };
  }
  
  const title = data.title || 'Zaalvoetbal Doorn';
  
  // Flexibel schema: ondersteun zowel {url: '...'} als {data: {url: '...'}}
  const notificationData = data.data ? data.data : (data.url ? { url: data.url } : {});
  
  const options = {
    body: data.body || 'Je hebt een nieuwe melding!',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    data: notificationData,
    requireInteraction: false,
    silent: false,
    tag: 'futsal-notification-' + Date.now()
  };
  
  console.log('📢 About to show notification:', title, options);
  console.log('🔍 Registration state:', self.registration);
  console.log('🔍 Notification permission:', Notification ? Notification.permission : 'Notification API not available');
  
  const notificationPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      console.log('👁️ Found clients:', clients.length);
      clients.forEach(client => {
        try {
          client.postMessage({ type: 'PUSH_NOTIFICATION', ...data });
        } catch (e) {
          console.warn('⚠️ Failed to postMessage to client:', e);
        }
      });

      return self.registration.showNotification(title, options)
        .then(() => self.registration.getNotifications())
        .then(notifications => {
          console.log('📊 Active notifications count:', notifications.length);
          return 'Browser notification shown';
        });
    })
    .catch(error => {
      console.error('❌ Failed to handle push notification:', error);
      return self.registration.showNotification('Fallback Notification');
    });
    
  event.waitUntil(notificationPromise);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
