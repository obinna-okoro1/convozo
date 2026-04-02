/**
 * PortalPage — selectors and interactions for /portal (client magic-link auth).
 *
 * Covers the unauthenticated email form, link-sent confirmation, and the
 * authenticated portal tabs (Messages / Bookings).
 */
export class PortalPage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  visit(): this {
    cy.visit('/portal');
    return this;
  }

  // ── Email sign-in form ─────────────────────────────────────────────────────

  fillEmail(email: string): this {
    cy.get('input#portal-email').type(email);
    return this;
  }

  submitEmailForm(): this {
    cy.contains('button', /send sign.in link|get link/i).click();
    return this;
  }

  interceptGetPortal(alias = 'getPortal'): this {
    cy.intercept('POST', /\/functions\/v1\/get-client-portal/).as(alias);
    return this;
  }

  interceptSendOtp(alias = 'sendOtp'): this {
    // Stub the OTP response so the unauthenticated UI test never reaches GoTrue.
    // This prevents consuming the global auth email rate-limit (max_frequency)
    // which the real magic-link test needs a few seconds later.
    cy.intercept('POST', /\/auth\/v1\/otp/, { statusCode: 200, body: {} }).as(alias);
    return this;
  }

  // ── Authenticated portal tabs ──────────────────────────────────────────────

  clickMessagesTab(): this {
    cy.contains('button', /messages/i, { timeout: 8000 }).click();
    return this;
  }

  clickBookingsTab(): this {
    cy.contains('button', /sessions|bookings/i, { timeout: 8000 }).click();
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  assertEmailFormVisible(): this {
    cy.get('input#portal-email').should('be.visible');
    cy.contains('button', /send sign.in link|get link/i).should('be.visible');
    return this;
  }

  assertLinkSentConfirmation(): this {
    cy.contains(/check your (email|inbox)|link sent|we.ve sent|we sent/i, {
      timeout: 10000,
    }).should('be.visible');
    return this;
  }

  assertMessagesTabVisible(): this {
    cy.contains(/messages|my messages/i, { timeout: 10000 }).should(
      'be.visible',
    );
    return this;
  }

  assertMessageContentVisible(text: string): this {
    cy.contains(text, { timeout: 10000 }).should('be.visible');
    return this;
  }

  assertNoError(): this {
    cy.get('body').should('not.contain.text', 'Error');
    return this;
  }
}

export const portalPage = new PortalPage();
