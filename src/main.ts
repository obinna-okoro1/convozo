import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig)
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console -- bootstrap failed, so no ErrorHandler exists to report through
    console.error(err);
  });
