/**
 * 08-settings.cy.ts — Creator settings panel
 *
 * Pure UI tests. Logs in as the seed creator and exercises the settings UI.
 * No backend seeding or manipulation.
 */

import { settingsPage } from '../support/page-objects';

export {};

const CREATOR_EMAIL = 'creator@example.com';
const CREATOR_PASS = 'sample123';
const CREATOR_SLUG = 'sarahjohnson';

describe('Creator Settings', () => {
  beforeEach(() => {
    cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    settingsPage.visit(CREATOR_SLUG);
  });

  it('renders the settings page', () => {
    settingsPage.assertPageVisible();
  });

  it('shows the profile/general settings section with display name', () => {
    settingsPage.assertDisplayNameInputVisible();
  });

  it('can update the display name and save', () => {
    settingsPage.interceptUpdateCreator();
    settingsPage.getDisplayNameInput().clear().type('Dwayne Johnson (E2E Updated)');
    settingsPage.clickSave();
    cy.wait('@updateCreator').its('response.statusCode').should('be.oneOf', [200, 204]);

    // Revert so we don't break other tests
    settingsPage.getDisplayNameInput().clear().type('Dwayne Johnson');
    settingsPage.clickSave();
  });

  it('shows the pricing section with message price', () => {
    settingsPage.clickPricingSection();
    settingsPage.assertPriceInputVisible();
  });

  it('can update the message price', () => {
    settingsPage.clickPricingSection();
    settingsPage.interceptUpdateSettings();
    settingsPage.getPriceInput().clear().type('15');
    settingsPage.clickSave();
    cy.wait('@updateSettings').its('response.statusCode').should('be.oneOf', [200, 204]);

    // Revert to original price
    settingsPage.getPriceInput().clear().type('10');
    settingsPage.clickSave();
  });

  it('shows availability settings (days of week)', () => {
    settingsPage.clickAvailabilitySection();
    settingsPage.assertAvailabilityDaysVisible();
  });

  it('shows the Link-in-Bio / links section', () => {
    settingsPage.clickLinksSection();
    settingsPage.assertLinksVisible();
  });

  it('shows response time setting', () => {
    settingsPage.clickPricingSection();
    settingsPage.assertResponseTimeVisible();
  });
});
