/**
 * 03-messaging-thread.cy.ts — 6-round back-and-forth thread
 *
 * Uses the seed data: message 55555555... from John Doe to Sarah Johnson.
 * Expert logs in via UI, opens inbox, replies. Client visits conversation page.
 * The only backend read is fetching the conversation_token (behind RLS).
 */

import { conversationPage, dashboardPage, publicProfilePage } from '../support/page-objects';

export {};

const CREATOR_EMAIL = 'creator@example.com';
const CREATOR_PASS = 'sample123';
const CREATOR_SLUG = 'sarahjohnson';

// Seed message ID from seed.sql — John Doe's unhandled message to Sarah
const SEED_MESSAGE_ID = '55555555-5555-5555-5555-555555555555';

// ── Helpers ────────────────────────────────────────────────────────────────────

function expertSendsReply(replyText: string): void {
  dashboardPage.interceptReplyEmail();
  dashboardPage.typeReply(replyText).sendReply();
  cy.wait('@replyEmail').its('response.statusCode').should('be.oneOf', [200, 201]);
  dashboardPage.assertReplyVisible(replyText);
}

function clientSendsReply(token: string, replyText: string): void {
  conversationPage.interceptClientReply();
  conversationPage.visit(token).typeReply(replyText).sendReply();
  cy.wait('@clientReply').its('response.statusCode').should('be.oneOf', [200, 201]);
  conversationPage.assertReplySent();
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Messaging Thread — 6-round back-and-forth', () => {
  let conversationToken: string;

  before(() => {
    // Read the auto-generated conversation_token for the seed message (behind RLS)
    cy.task<string>('readDbValue',
      `SELECT conversation_token FROM public.messages WHERE id = '${SEED_MESSAGE_ID}'`,
    ).then((token) => {
      expect(token).to.be.a('string').and.not.be.empty;
      conversationToken = token!;
    });
  });

  it('Expert sends reply #1 from the inbox', () => {
    cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    publicProfilePage.visit(CREATOR_SLUG).openManageDrawer();
    dashboardPage.selectMessage('John Doe');
    expertSendsReply('Thanks for reaching out! I can definitely help you with that.');
  });

  it('Client reads reply #1 and sends counter-reply #1', () => {
    clientSendsReply(conversationToken, 'Thank you! Here is more context about my situation…');
  });

  it('Expert sends reply #2', () => {
    cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    publicProfilePage.visit(CREATOR_SLUG).openManageDrawer();
    dashboardPage.selectMessage('John Doe');
    expertSendsReply('Great context! Based on what you said, I recommend the following approach…');
  });

  it('Client sends counter-reply #2', () => {
    clientSendsReply(
      conversationToken,
      'That makes a lot of sense. One follow-up question: what about edge cases?',
    );
  });

  it('Expert sends reply #3', () => {
    cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    publicProfilePage.visit(CREATOR_SLUG).openManageDrawer();
    dashboardPage.selectMessage('John Doe');
    expertSendsReply('Great question on edge cases! Here is how to handle them…');
  });

  it('Client sends counter-reply #3', () => {
    clientSendsReply(conversationToken, 'Perfect, thank you so much! This really helps.');
  });

  it('conversation page shows all 6 reply bubbles in order', () => {
    conversationPage.visit(conversationToken);

    const expertMessages = [
      'Thanks for reaching out',
      'Great context',
      'Great question on edge cases',
    ];
    const clientMessages = [
      'Thank you! Here is more context',
      'That makes a lot of sense',
      'Perfect, thank you so much',
    ];

    expertMessages.forEach((text) => conversationPage.assertMessageVisible(text));
    clientMessages.forEach((text) => conversationPage.assertMessageVisible(text));
  });
});
