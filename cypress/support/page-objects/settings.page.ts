/**
 * SettingsPage — selectors and interactions for /:slug/settings.
 *
 * Abstracts the deeply-nested form selectors that appear multiple times within
 * the settings spec and any future spec that tests creator preferences.
 */
export class SettingsPage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  visit(slug: string): this {
    cy.visit(`/${slug}/settings`);
    return this;
  }

  // ── Section navigation ─────────────────────────────────────────────────────

  /** Clicks the Monetization tab — message price, availability, and response time live here. */
  clickPricingSection(): this {
    cy.contains('button', /Monetization|Monetize/i, { timeout: 8000 }).first().click();
    return this;
  }

  /** Opens the Monetization tab — availability (Weekly Schedule) is embedded inside. */
  clickAvailabilitySection(): this {
    cy.contains('button', /Monetization|Monetize/i, { timeout: 8000 }).first().click();
    return this;
  }

  /**
   * Links are managed from the public profile's default Links tab (not in the
   * settings drawer). Navigate back to /:slug so the owner sees the Links view.
   */
  clickLinksSection(): this {
    cy.location('pathname').then((path) => {
      const slug = path.split('/')[1];
      cy.visit(`/${slug}`);
    });
    return this;
  }

  // ── Form fields ────────────────────────────────────────────────────────────

  /** Returns the display name input (not a chainable this — callers chain .clear().type() on it). */
  getDisplayNameInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy
      .get(
        'input[placeholder*="display name"], input[placeholder*="Your Name"], input[formControlName="displayName"]',
        { timeout: 8000 },
      )
      .first();
  }

  getPriceInput(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy
      .get('input[type=number], input[placeholder*="price"]', { timeout: 6000 })
      .first();
  }

  clickSave(): this {
    cy.contains('button', /save|update/i).first().click();
    return this;
  }

  // ── Intercepts ─────────────────────────────────────────────────────────────

  interceptUpdateCreator(alias = 'updateCreator'): this {
    cy.intercept('PATCH', '**/rest/v1/creators*').as(alias);
    return this;
  }

  interceptUpdateSettings(alias = 'updateSettings'): this {
    cy.intercept('PATCH', '**/rest/v1/creator_settings*').as(alias);
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  assertPageVisible(): this {
    cy.contains(/settings|profile settings/i, { timeout: 10000 }).should(
      'be.visible',
    );
    return this;
  }

  assertDisplayNameInputVisible(): this {
    this.getDisplayNameInput().should('be.visible');
    return this;
  }

  assertPriceInputVisible(): this {
    this.getPriceInput().should('be.visible');
    return this;
  }

  assertAvailabilityDaysVisible(): this {
    cy.contains(/monday|tuesday|wednesday|thursday|friday/i, {
      timeout: 10000,
    }).scrollIntoView().should('be.visible');
    return this;
  }

  assertLinksVisible(): this {
    cy.contains(/add new link/i, { timeout: 6000 }).should('be.visible');
    return this;
  }

  assertResponseTimeVisible(): this {
    cy.contains(/response time|responds within/i, { timeout: 8000 })
      .scrollIntoView()
      .should('be.visible');
    return this;
  }
}

export const settingsPage = new SettingsPage();
