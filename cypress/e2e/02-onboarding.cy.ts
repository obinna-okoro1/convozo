/**
 * 02-onboarding.cy.ts — Creator onboarding (4-step wizard)
 *
 * UI-first: Signs up a new user through the UI, confirms via Mailpit email,
 * then completes the full onboarding wizard — no backend user creation.
 */

import { authPage, onboardingPage } from '../support/page-objects';

export {};

const EXPERT_EMAIL = `e2e-onboard-${String(Date.now())}@convozo.test`;
const EXPERT_PASS = 'TestPass88!';
const EXPERT_SLUG = `e2e-expert-${Date.now()}`;
const EXPERT_NAME = 'E2E Expert';

describe('Creator Onboarding', () => {
  before(() => {
    // Clear Mailpit so we only see emails from this test
    cy.task('clearMailpit');
  });

  after(() => {
    cy.task('deleteUserByEmail', EXPERT_EMAIL);
  });

  it('signs up, confirms email, and completes all 4 onboarding steps', () => {
    // ── Step 0: Sign up via UI ────────────────────────────────────────────────
    authPage.visitSignup();
    authPage
      .typeFullName(EXPERT_NAME)
      .typeEmail(EXPERT_EMAIL)
      .typePassword(EXPERT_PASS)
      .submit();
    authPage.assertSignupSuccess();

    // ── Step 0b: Confirm email via Mailpit ────────────────────────────────────
    // Poll Mailpit for the confirmation email, extract the verify URL,
    // then visit it — this is the real email-confirmation flow.
    cy.task<string>('pollMailpitForLink', {
      email: EXPERT_EMAIL,
      redirectTo: 'http://localhost:4200/auth/callback',
    }).then((verifyUrl) => {
      cy.visit(verifyUrl);
    });

    // After email confirmation, the app redirects to onboarding (no profile yet)
    cy.location('pathname', { timeout: 15000 }).should('include', '/creator/onboarding');

    // ── Step 1: Profile ───────────────────────────────────────────────────────
    onboardingPage.assertStep1Visible();
    onboardingPage.fillDisplayName(EXPERT_NAME);

    onboardingPage.interceptSlugCheck();
    onboardingPage.fillSlug(EXPERT_SLUG);
    cy.wait('@slugCheck');

    onboardingPage.fillBio('E2E automated test profile — do not use.');
    onboardingPage.fillPhoneNumber('5551234567');
    onboardingPage.clickContinue();

    // ── Step 2: Expertise (category required) ─────────────────────────────────
    onboardingPage.assertStep2Visible();
    onboardingPage.selectCategory(/legal/i);
    onboardingPage.clickContinue();

    // ── Step 3: Payments Info (informational — just continue) ─────────────────
    onboardingPage.assertStep3Visible();
    onboardingPage.clickContinue();

    // ── Step 4: Review & Create Account ───────────────────────────────────────
    onboardingPage.assertStep4Visible();
    onboardingPage.assertNameVisible(EXPERT_NAME);
    onboardingPage.interceptCreateCreator();
    onboardingPage.clickCreateAccount();
    onboardingPage.assertPublishedProfile(EXPERT_SLUG, EXPERT_NAME);
  });
});
