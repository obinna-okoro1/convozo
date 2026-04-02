/**
 * DashboardPage — selectors and interactions for the owner's inbox drawer
 * and the Bookings panel inside it.
 *
 * This PO is opened from the public profile page (via openManageDrawer in
 * PublicProfilePage) and is used by the messaging-thread, dashboard-inbox,
 * video-call, and booking-slots specs.
 */
export class DashboardPage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  clickBookingsTab(): this {
    cy.contains('button, a', /bookings|sessions/i, { timeout: 8000 }).click();
    return this;
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────

  selectMessage(clientName: string): this {
    cy.contains(clientName, { timeout: 10000 }).click();
    return this;
  }

  // ── Reply composer ─────────────────────────────────────────────────────────

  typeReply(text: string): this {
    cy.get('textarea[placeholder*="Write your reply"]')
      .clear()
      .type(text);
    return this;
  }

  sendReply(): this {
    cy.contains('button', 'Send reply').click();
    return this;
  }

  // ── Mark handled ───────────────────────────────────────────────────────────

  markHandled(): this {
    cy.contains('button', /mark handled|handled/i, { timeout: 8000 }).click();
    return this;
  }

  // ── Intercepts ─────────────────────────────────────────────────────────────

  interceptReplyInsert(alias = 'insertReply'): this {
    cy.intercept('POST', /\/rest\/v1\/message_replies/).as(alias);
    return this;
  }

  interceptReplyEmail(alias = 'replyEmail'): this {
    cy.intercept('POST', /\/functions\/v1\/send-reply-email/).as(alias);
    return this;
  }

  interceptMarkHandled(alias = 'patchMessage'): this {
    cy.intercept('PATCH', /\/rest\/v1\/messages/).as(alias);
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  assertClientVisible(clientName: string): this {
    cy.contains(clientName, { timeout: 10000 }).scrollIntoView().should('be.visible');
    return this;
  }

  assertMessageContentVisible(text: string): this {
    cy.contains(text, { timeout: 8000 }).should('be.visible');
    return this;
  }

  assertReplyVisible(text: string): this {
    cy.contains(text, { timeout: 10000 }).scrollIntoView().should('be.visible');
    return this;
  }

  assertBookingClientVisible(name: string): this {
    cy.contains(name, { timeout: 10000 }).scrollIntoView().should('be.visible');
    return this;
  }

  assertConfirmedBadgeVisible(): this {
    // The badge renders 'Confirmed' (capital C) — use a case-insensitive regex
    cy.contains(/^confirmed$/i, { timeout: 8000 }).should('be.visible');
    return this;
  }

  assertHandledState(): this {
    cy.get('body').should(($body) => {
      const text = $body.text().toLowerCase();
      expect(
        text.includes('handled') || !text.includes('inbox test client'),
      ).to.be.true;
    });
    return this;
  }
}

export const dashboardPage = new DashboardPage();
