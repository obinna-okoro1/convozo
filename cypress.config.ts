import { defineConfig } from 'cypress';
import { tasks } from './cypress/support/tasks';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    experimentalRunAllSpecs: true,

    setupNodeEvents(on) {
      on('task', tasks);
    },
  },

  env: {
    // Local Supabase — public keys only (safe to commit)
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseAnonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  },
});
