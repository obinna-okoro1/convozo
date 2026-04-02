/**
 * PublicProfilePage — selectors and interactions for /:slug (public view).
 *
 * Covers tab navigation (Message / Call / Support), the owner sign-out button,
 * and common assertions about rendered profile data.
 */
export class PublicProfilePage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  visit(slug: string): this {
    cy.visit(`/${slug}`);
    return this;
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  clickMessageTab(): this {
    cy.contains('a', 'Consult', { timeout: 8000 }).first().click();
    return this;
  }

  /** Matches the exact Call tab label — actual UI label is 'Session'. */
  clickCallTab(): this {
    cy.contains('a', 'Session', { timeout: 10000 }).first().click();
    return this;
  }

  clickSupportTab(): this {
    cy.contains('a, button', /support|tip/i).first().click();
    return this;
  }

  // ── Owner controls ─────────────────────────────────────────────────────────

  /**
   * Opens the manage / inbox drawer that's only visible to the logged-in owner.
   */
  openManageDrawer(): this {
    cy.contains('button', /inbox|manage/i, { timeout: 8000 }).first().click();
    return this;
  }

  /** Clicks the sign-out button inside the owner toolbar. */
  signOut(): this {
    cy.contains('button', /sign out|log out/i, { timeout: 8000 }).click();
    // Wait for the session to clear (Supabase JS v2 may not emit a network
    // request in local mode — check URL change instead of intercepting the request)
    cy.location('pathname', { timeout: 12000 }).should('match', /^\/($|home|auth\/login)/);
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  assertExpertName(name: string): this {
    cy.contains(name, { timeout: 10000 }).should('be.visible');
    return this;
  }

  assertMessageFormVisible(): this {
    cy.get('input#senderName, input[placeholder*="name"]', {
      timeout: 8000,
    }).should('be.visible');
    cy.get('input#senderEmail, input[placeholder*="email"]').should(
      'be.visible',
    );
    cy.get(
      'textarea#messageContent, textarea[placeholder*="message"]',
    ).should('be.visible');
    return this;
  }

  assertPriceVisible(): this {
    cy.contains(/\$\d+|\d+\.?\d* ?(USD|usd)/i, { timeout: 8000 }).should(
      'be.visible',
    );
    return this;
  }

  assertCallFormIntro(): this {
    cy.contains(/book|schedule|available/i, { timeout: 8000 }).should(
      'be.visible',
    );
    return this;
  }

  assertSupportSectionVisible(): this {
    cy.contains(/support|tip|send/i, { timeout: 8000 }).should('be.visible');
    return this;
  }

  assertSubmitButtonVisible(): this {
    cy.contains('button', /proceed|pay|send|submit/i, { timeout: 8000 })
      .scrollIntoView()
      .should('be.visible');
    return this;
  }
}

export const publicProfilePage = new PublicProfilePage();
