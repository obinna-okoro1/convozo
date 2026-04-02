/**
 * OnboardingPage — selectors and interactions for /creator/onboarding.
 *
 * The 4-step wizard:
 *   Step 1: Profile (display name, slug, bio, phone number)
 *   Step 2: Your Expertise (category required, subcategory optional, etc.)
 *   Step 3: Payments Info (informational — just Continue)
 *   Step 4: Review & Create Account
 */
export class OnboardingPage {
  // ── Step 1: Profile ────────────────────────────────────────────────────────

  assertStep1Visible(): this {
    cy.contains(/set up your profile|profile/i, { timeout: 10000 }).should(
      'be.visible',
    );
    return this;
  }

  fillDisplayName(name: string): this {
    cy.get('input[placeholder="Your Name"]').first().clear().type(name);
    return this;
  }

  interceptSlugCheck(alias = 'slugCheck'): this {
    // Supabase JS uses { head: true } which sends a HEAD request for count queries.
    cy.intercept('HEAD', /\/rest\/v1\/creators.*slug/).as(alias);
    return this;
  }

  fillSlug(slug: string): this {
    cy.get('input[placeholder="yourname"]').first().clear().type(slug);
    return this;
  }

  fillBio(text: string): this {
    cy.get('textarea[placeholder*="Tell people"]').first().clear().type(text);
    return this;
  }

  fillPhoneNumber(phone: string): this {
    cy.get('input[placeholder="Phone number"]').first().clear().type(phone);
    return this;
  }

  clickContinue(): this {
    cy.contains('button', /continue/i).click();
    return this;
  }

  // ── Step 2: Expertise ─────────────────────────────────────────────────────

  assertStep2Visible(): this {
    cy.contains(/your expertise/i, { timeout: 8000 }).should('be.visible');
    return this;
  }

  /**
   * Selects a category from the searchable-select dropdown.
   * Opens the first app-searchable-select on step 2, then picks an option.
   */
  selectCategory(label: RegExp = /legal/i): this {
    // The category select is rendered via app-searchable-select.
    // Click the trigger button to open the dropdown.
    cy.get('app-searchable-select').first().find('button').first().click();
    // Pick the first matching option from the dropdown
    cy.contains('button', label, { timeout: 5000 }).click();
    return this;
  }

  // ── Step 3: Payments Info (informational) ─────────────────────────────────

  assertStep3Visible(): this {
    // Scope to h2 to avoid matching the sm:hidden mobile step-counter span
    cy.contains('h2', /getting paid/i, { timeout: 8000 }).should('be.visible');
    return this;
  }

  // ── Step 4: Review & Create Account ───────────────────────────────────────

  assertStep4Visible(): this {
    // Scope to h2 to avoid matching the sm:hidden mobile step-counter span
    cy.contains('h2', /review your profile/i, { timeout: 8000 }).should('be.visible');
    return this;
  }

  assertNameVisible(name: string): this {
    cy.contains(name).should('be.visible');
    return this;
  }

  interceptCreateCreator(alias = 'createCreator'): this {
    cy.intercept('POST', /\/rest\/v1\/creators/).as(alias);
    return this;
  }

  clickCreateAccount(): this {
    cy.contains('button', /create account/i).click();
    return this;
  }

  assertPublishedProfile(slug: string, name: string): this {
    cy.location('pathname', { timeout: 12000 }).should('include', slug);
    cy.contains(name, { timeout: 8000 }).should('be.visible');
    return this;
  }
}

export const onboardingPage = new OnboardingPage();
