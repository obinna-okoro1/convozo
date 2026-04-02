/**
 * AuthPage — selectors and interactions for /auth/login and /auth/signup.
 *
 * Centralises every form field, submit button, intercept alias, and assertion
 * so spec files never hard-code raw selectors for auth flows.
 */
export class AuthPage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  visit(): this {
    cy.visit('/auth/login');
    return this;
  }

  visitSignup(): this {
    cy.visit('/auth/signup');
    return this;
  }

  // ── Form fields ────────────────────────────────────────────────────────────

  typeFullName(name: string): this {
    cy.get('input#fullName').type(name);
    return this;
  }

  typeEmail(email: string): this {
    cy.get('input#email').type(email);
    return this;
  }

  typePassword(pass: string): this {
    cy.get('input#password').type(pass);
    // Fill confirmPassword only when present (signup form has it; login does not)
    cy.get('body').then(($body) => {
      if ($body.find('input#confirmPassword').length) {
        cy.get('input#confirmPassword').type(pass);
      }
    });
    return this;
  }

  submit(): this {
    cy.get('button[type=submit]').click();
    return this;
  }

  // ── Intercepts ─────────────────────────────────────────────────────────────

  interceptLogin(alias = 'authToken'): this {
    cy.intercept('POST', /\/auth\/v1\/token/).as(alias);
    return this;
  }

  interceptSignup(alias = 'signup'): this {
    cy.intercept('POST', /\/auth\/v1\/signup/).as(alias);
    return this;
  }

  interceptLogout(alias = 'logout'): this {
    cy.intercept('POST', /\/auth\/v1\/logout/).as(alias);
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  assertLoginFormVisible(): this {
    cy.get('input#email').should('be.visible');
    cy.get('input#password').should('be.visible');
    return this;
  }

  assertSignupFormVisible(): this {
    cy.get('input#fullName').should('be.visible');
    cy.get('input#email').should('be.visible');
    cy.get('input#password').should('be.visible');
    cy.get('button[type=submit]').should('be.visible');
    return this;
  }

  assertLoginError(): this {
    cy.get('.alert-error, [class*="error"]').should('be.visible');
    return this;
  }

  assertSignupSuccess(): this {
    cy.contains(/we sent a confirmation|check your email|verify your email/i, { timeout: 15000 }).should('be.visible');
    return this;
  }

  assertRedirectedAfterLogin(slug: string): this {
    cy.location('pathname', { timeout: 12000 }).should(
      'match',
      new RegExp(`/${slug}|/creator/onboarding`),
    );
    return this;
  }

  assertStaysOnSignup(): this {
    cy.location('pathname').should('include', '/auth/signup');
    return this;
  }
}

export const authPage = new AuthPage();
