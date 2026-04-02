/**
 * 01-auth.cy.ts — Authentication flows (pure UI)
 *
 * Uses the seed user creator@example.com / sample123 for login tests.
 * Creates a fresh user via the signup form for signup tests.
 */

import { authPage, publicProfilePage } from '../support/page-objects';

export {};

describe('Authentication', () => {
  const ts = String(Date.now());
  const newUserEmail = `e2e-new-${ts}@convozo.test`;
  const newUserPass = 'TestPass88!';

  // ── Signup ─────────────────────────────────────────────────────────────────

  describe('Sign-up', () => {
    beforeEach(() => {
      authPage.visitSignup();
    });

    it('renders the signup form', () => {
      authPage.assertSignupFormVisible();
    });

    it('shows validation errors for empty submission', () => {
      authPage.submit();
      authPage.assertStaysOnSignup();
    });

    it('shows a password length error for a short password', () => {
      authPage
        .typeFullName('Test User')
        .typeEmail(newUserEmail)
        .typePassword('short')
        .submit();
      cy.get('.alert-error, [class*="error"], [class*="alert"]').should('exist');
    });

    it('shows "verify your email" after a valid submission', () => {
      authPage
        .typeFullName('E2E Test User')
        .typeEmail(newUserEmail)
        .typePassword(newUserPass)
        .submit();
      authPage.assertSignupSuccess();
    });

    after(() => {
      cy.task('deleteUserByEmail', newUserEmail);
    });
  });

  // ── Login (uses seed user) ─────────────────────────────────────────────────

  describe('Login', () => {
    beforeEach(() => {
      authPage.visit();
    });

    it('renders the login form', () => {
      authPage.assertLoginFormVisible();
      cy.get('button[type=submit]').should('contain.text', 'Sign in');
    });

    it('shows an error for incorrect credentials', () => {
      authPage.interceptLogin();
      authPage
        .typeEmail('creator@example.com')
        .typePassword('wrong-password')
        .submit();
      cy.wait('@authToken').its('response.statusCode').should('eq', 400);
      authPage.assertLoginError();
    });

    it('redirects to the creator profile page after successful login', () => {
      authPage.interceptLogin();
      authPage
        .typeEmail('creator@example.com')
        .typePassword('sample123')
        .submit();
      cy.wait('@authToken').its('response.statusCode').should('eq', 200);
      authPage.assertRedirectedAfterLogin('sarahjohnson');
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe('Logout', () => {
    it('clears the session and returns to public page', () => {
      cy.loginAs('creator@example.com', 'sample123');
      publicProfilePage.visit('sarahjohnson').signOut();
      cy.location('pathname', { timeout: 8000 }).should('match', /^\/($|home|auth\/login)/);
    });
  });
});
