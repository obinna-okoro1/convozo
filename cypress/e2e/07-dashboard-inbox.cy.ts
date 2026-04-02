/**
 * 07-dashboard-inbox.cy.ts — Expert inbox (owner-only panel)
 *
 * Uses seed messages from seed.sql:
 *   - 77777777... Brand Manager → view, reply, and first-open tests
 *   - 55555555... John Doe (unhandled) → mark-as-handled test
 *     (Brand Manager gets marked handled by the reply/view tests above it)
 *
 * Expert logs in via UI, navigates to their profile, opens the inbox drawer.
 * No backend seeding — only reads and UI interactions.
 */

import { dashboardPage, publicProfilePage } from '../support/page-objects';

export {};

const CREATOR_EMAIL = 'creator@example.com';
const CREATOR_PASS = 'sample123';
const CREATOR_SLUG = 'sarahjohnson';

describe('Expert Dashboard — Inbox', () => {
  beforeEach(() => {
    cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    publicProfilePage.visit(CREATOR_SLUG).openManageDrawer();
  });

  it('inbox drawer opens and shows messages', () => {
    dashboardPage.assertClientVisible('Brand Manager');
  });

  it('clicking a message shows the message content', () => {
    dashboardPage.selectMessage('Brand Manager');
    dashboardPage.assertMessageContentVisible('interested in a sponsored content');
  });

  it('can send a reply from the inbox', () => {
    dashboardPage.interceptReplyEmail();
    dashboardPage.selectMessage('Brand Manager');
    dashboardPage
      .typeReply('Thanks for reaching out via the inbox test.')
      .sendReply();
    cy.wait('@replyEmail').its('response.statusCode').should('be.oneOf', [200, 201]);
    dashboardPage.assertReplyVisible('Thanks for reaching out via the inbox test.');
  });

  it('can mark a message as handled', () => {
    // Use John Doe's message (55555555...) — it stays unhandled even after
    // earlier tests in this suite select and reply to Brand Manager.
    // Selecting an unhandled message auto-triggers a PATCH to mark it handled.
    dashboardPage.interceptMarkHandled();
    dashboardPage.selectMessage('John Doe');
    cy.wait('@patchMessage', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204]);
    dashboardPage.assertHandledState();
  });
});
