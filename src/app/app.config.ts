import { APP_INITIALIZER, ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Delay SW registration until 'load' to avoid competing with critical resources on initial paint.
// Disabled in dev mode to keep hot-reload working.
function registerServiceWorker(): () => void {
  return () => {
    if ('serviceWorker' in navigator && !isDevMode()) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
          console.warn('[SW] Registration failed:', err);
        });
      });
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Register the service worker programmatically — no <script> in index.html needed.
    { provide: APP_INITIALIZER, useFactory: registerServiceWorker, multi: true },
  ],
};
