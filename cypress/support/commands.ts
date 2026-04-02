/**
 * Cypress custom commands.
 *
 * Rules:
 *   - NO cy.wait(number) — use cy.intercept aliases or DOM-driven assertions.
 *   - All Supabase auth calls use the REST API so we get a real session token
 *     that Angular's Supabase client will accept on first load.
 */

/// <reference types="cypress" />

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./index.d.ts" />

// ─── loginAs ─────────────────────────────────────────────────────────────────
/**
 * Authenticates via Supabase's password endpoint and injects the resulting
 * session into localStorage, so the Angular app boots as that user without
 * going through the login page.
 *
 * Usage: cy.loginAs('creator@example.com', 'sample123')
 */
Cypress.Commands.add('loginAs', (email: string, password: string) => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const supabaseUrl = Cypress.env('supabaseUrl') as string;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const anonKey = Cypress.env('supabaseAnonKey') as string;

  cy.request({
    method: 'POST',
    url: `${supabaseUrl}/auth/v1/token?grant_type=password`,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: { email, password },
  }).then((res) => {
    const session = res.body as {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      token_type: string;
      user: { id: string; email: string };
    };

    // Build the same object structure that @supabase/supabase-js persists.
    const storageValue = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      token_type: session.token_type,
      user: session.user,
    });

    cy.window().then((win) => {
      // Write under every possible key variant so whichever one the app reads
      // is already populated.
      win.localStorage.setItem('sb-127-auth-token', storageValue);
      win.localStorage.setItem('supabase.auth.token', storageValue);
    });
  });
});

// ─── logout ──────────────────────────────────────────────────────────────────
Cypress.Commands.add('logout', () => {
  cy.window().then((win) => {
    win.localStorage.clear();
  });
  cy.visit('/');
});

// ─── interceptSupabase ───────────────────────────────────────────────────────
/**
 * Sets up broad Cypress intercepts for Supabase traffic.
 * Individual specs can create more specific aliases on top of these.
 */
Cypress.Commands.add('interceptSupabase', () => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const supabaseUrl = Cypress.env('supabaseUrl') as string;
  cy.intercept('POST', `${supabaseUrl}/auth/v1/**`).as('supabaseAuth');
  cy.intercept('**', `${supabaseUrl}/rest/v1/**`).as('supabaseRest');
  cy.intercept('POST', `${supabaseUrl}/functions/v1/**`).as('supabaseFn');
});
