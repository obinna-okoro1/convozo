/**
 * ConversationPage — selectors and interactions for /conversation/:token.
 *
 * Used by the messaging-thread and portal specs to represent the client-side
 * view of a message thread.
 */
export class ConversationPage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  visit(token: string): this {
    cy.visit(`/conversation/${token}`);
    return this;
  }

  // ── Reply composer ─────────────────────────────────────────────────────────

  typeReply(text: string): this {
    cy.get('textarea[placeholder*="Write your reply"]', {
      timeout: 10000,
    }).should('be.visible');
    cy.get('textarea[placeholder*="Write your reply"]').clear().type(text);
    return this;
  }

  sendReply(): this {
    cy.contains('button', 'Send reply').click();
    return this;
  }

  // ── Intercepts ─────────────────────────────────────────────────────────────

  interceptClientReply(alias = 'clientReply'): this {
    cy.intercept('POST', /\/functions\/v1\/post-client-reply/).as(alias);
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  assertReplySent(): this {
    cy.contains(/reply sent|sent/i, { timeout: 8000 }).should('be.visible');
    return this;
  }

  assertMessageVisible(text: string): this {
    cy.contains(text, { timeout: 10000 }).should('be.visible');
    return this;
  }

  assertOnConversationPage(token: string): this {
    cy.location('pathname', { timeout: 10000 })
      .should('include', '/conversation/')
      .should('include', token);
    return this;
  }
}

export const conversationPage = new ConversationPage();
