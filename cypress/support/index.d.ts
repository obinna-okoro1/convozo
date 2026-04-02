/**
 * Global type augmentations for Cypress custom commands.
 * This file is triple-slash referenced by cypress/support/e2e.ts.
 */

/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Logs in via Supabase password auth without touching the UI.
     * Sets localStorage so the Angular app picks up the session on reload.
     */
    loginAs(email: string, password: string): Chainable<void>;

    /** Clears Supabase auth state and navigates home. */
    logout(): Chainable<void>;

    /**
     * Intercepts the set of Supabase API endpoints most commonly called.
     * Call at the start of each spec to capture baseline traffic.
     */
    interceptSupabase(): Chainable<void>;
  }
}
