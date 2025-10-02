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


// Service Worker is now handled by Angular ServiceWorkerModule
// Custom VAPID push handler is injected into ngsw-worker.js during build


/*
Copyright Google LLC. All Rights Reserved.
Use of this source code is governed by an MIT-style license that
can be found in the LICENSE file at https://angular.io/license
*/