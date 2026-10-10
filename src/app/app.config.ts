import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

// Delay SW registration until 'load' to avoid competing with critical resources on initial paint.
// Disabled in dev mode to keep hot-reload working.
function registerServiceWorker(): void {
  const errorHandler = inject(ErrorHandler);

  if ('serviceWorker' in navigator && !isDevMode()) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .catch((err: unknown) => {
          errorHandler.handleError(new Error('[SW] Registration failed', { cause: err }));
        });
    });
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Register the service worker programmatically — no <script> in index.html needed.
    provideAppInitializer(registerServiceWorker),
  ],
};
