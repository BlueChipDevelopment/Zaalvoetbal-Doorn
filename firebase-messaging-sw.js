// This service worker will handle push events for Firebase Cloud Messaging and custom push notifications.
// It will be registered alongside the Angular service worker (ngsw-worker.js).

console.log('🚀 Firebase messaging service worker loaded');

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
    console.log('📦 Push data:', event.data.text());
    try {
      data = event.data.json();
      console.log('✅ Parsed push data:', data);
    } catch (e) {
      console.error('❌ Failed to parse push data:', e);
      data = { title: 'Test Notification', body: event.data.text() };
    }
  } else {
    console.log('⚠️ No push data received, using default');
    data = { title: 'Zaalvoetbal Doorn', body: 'Test notificatie zonder data' };
  }
  
  const title = data.title || 'Zaalvoetbal Doorn';
  const options = {
    body: data.body || 'Je hebt een nieuwe melding!',
    icon: 'assets/icons/icon-192x192.png',
    badge: 'assets/icons/icon-72x72.png',
    data: data.url ? { url: data.url } : {},
    requireInteraction: false, // Don't require user interaction
    silent: false, // Make sure it's not silent
    tag: 'futsal-notification-' + Date.now() // Unique tag to prevent grouping
  };
  
  console.log('📢 About to show notification:', title, options);
  console.log('🔍 Registration state:', self.registration);
  console.log('🔍 Notification permission:', Notification ? Notification.permission : 'Notification API not available');
  
  // Check if any client (browser tab) is currently focused
  const notificationPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      console.log('👁️ Found clients:', clients.length);
      
      let hasVisibleClient = false;
      clients.forEach((client, index) => {
        console.log(`Client ${index + 1}:`, {
          url: client.url,
          focused: client.focused,
          visibilityState: client.visibilityState
        });
        if (client.focused || client.visibilityState === 'visible') {
          hasVisibleClient = true;
        }
      });
      
      console.log('👀 Has visible/focused client:', hasVisibleClient);
      
      // Always show browser notification regardless of page visibility
      console.log('📢 Showing browser notification (ignoring page visibility)');
      {
        console.log('📢 Page not visible - showing browser notification');
        // Show notification when page is not visible
        return self.registration.showNotification(title, options)
          .then(() => {
            console.log('✅ Notification shown successfully!');
            return self.registration.getNotifications();
          })
          .then(notifications => {
            console.log('📊 Active notifications count:', notifications.length);
            console.log('📊 Active notifications:', notifications.map(n => ({ title: n.title, body: n.body, tag: n.tag })));
            return 'Browser notification shown';
          });
      }
    })
    .catch(error => {
      console.error('❌ Failed to handle push notification:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Fallback: always try to show notification
      console.log('🔄 Trying fallback notification...');
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
