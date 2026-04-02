/**
 * 06-public-profile.cy.ts — Public-facing profile page
 *
 * Pure UI tests — no backend manipulation. Uses the seed creator sarahjohnson.
 */

import { publicProfilePage } from '../support/page-objects';

export {};

const SLUG = 'sarahjohnson';

describe('Public Profile Page', () => {
  // ── Landing page ───────────────────────────────────────────────────────────

  describe('Landing page', () => {
    it('loads and shows a call-to-action', () => {
      cy.visit('/');
      cy.contains(/Start Free|Claim Your Free Link|Claim Your Free Profile/i, { timeout: 10000 }).should('be.visible');
    });

    it('CTA navigates to signup', () => {
      cy.visit('/');
      cy.contains('a', /Start Free|Claim Your Free/i).first().click();
      cy.location('pathname', { timeout: 8000 }).should('match', /\/(auth\/signup|home)/);
    });
  });

  // ── Profile page ───────────────────────────────────────────────────────────

  describe(`Expert profile — /${SLUG}`, () => {
    beforeEach(() => {
      publicProfilePage.visit(SLUG);
    });

    it('renders the expert display name', () => {
      publicProfilePage.assertExpertName('Dwayne Johnson');
    });

    it('shows the Message tab and loads the message form', () => {
      publicProfilePage.clickMessageTab();
      publicProfilePage.assertMessageFormVisible();
    });

    it('message form shows the expert price', () => {
      publicProfilePage.clickMessageTab();
      publicProfilePage.assertPriceVisible();
    });

    it('shows the Call tab with a booking form', () => {
      publicProfilePage.clickCallTab();
      publicProfilePage.assertCallFormIntro();
    });

    it('shows the Support tab', () => {
      publicProfilePage.clickSupportTab();
      publicProfilePage.assertSupportSectionVisible();
    });

    it('submit button on the message form is present', () => {
      publicProfilePage.clickMessageTab();
      publicProfilePage.assertSubmitButtonVisible();
    });
  });

  // ── 404 / inactive profile ─────────────────────────────────────────────────

  describe('Unknown profile', () => {
    it('shows a not-found state for a non-existent slug', () => {
      cy.visit('/this-slug-definitely-does-not-exist-12345', { failOnStatusCode: false });
      cy.contains(/not found|does not exist|no expert|404/i, { timeout: 10000 }).should('be.visible');
    });
  });
});
