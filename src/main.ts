import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';

// Suppress browser extension errors
const originalError = console.error;
console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  // Skip browser extension related errors
  if (message.includes('browser is not defined') ||
      message.includes('checkPageManual.js') ||
      message.includes('overlays.js')) {
    return;
  }
  originalError.apply(console, args);
};

// Suppress uncaught extension errors globally
window.addEventListener('error', (event) => {
  const message = event.message || '';
  const filename = event.filename || '';

  if (message.includes('browser is not defined') ||
      filename.includes('checkPageManual.js') ||
      filename.includes('overlays.js')) {
    event.preventDefault();
    return;
  }
});

platformBrowserDynamic().bootstrapModule(AppModule);


// Register the custom service worker for push notifications (in addition to ngsw-worker.js)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    console.log('🚀 Registering Firebase messaging service worker...');
    navigator.serviceWorker.register('firebase-messaging-sw.js')
      .then((registration) => {
        console.log('✅ Firebase messaging SW registered:', registration);
        console.log('📍 Scope:', registration.scope);
        console.log('📍 Active worker:', registration.active);
        console.log('📍 Installing worker:', registration.installing);
        console.log('📍 Waiting worker:', registration.waiting);
        
        // Check if service worker is ready
        return navigator.serviceWorker.ready;
      })
      .then((registration) => {
        console.log('🔄 Service worker is ready:', registration);
      })
      .catch((error) => {
        console.error('❌ Firebase messaging SW registration failed:', error);
      });
    
    // Also log all registered service workers
    navigator.serviceWorker.getRegistrations()
      .then(registrations => {
        console.log('📋 All registered service workers:', registrations.length);
        registrations.forEach((reg, index) => {
          console.log(`SW ${index + 1}:`, {
            scope: reg.scope,
            active: reg.active ? reg.active.scriptURL : null,
            installing: reg.installing ? reg.installing.scriptURL : null,
            waiting: reg.waiting ? reg.waiting.scriptURL : null
          });
        });
      })
      .catch(error => {
        console.error('❌ Failed to get service worker registrations:', error);
      });
  });
}


/*
Copyright Google LLC. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at https://angular.io/license
*/