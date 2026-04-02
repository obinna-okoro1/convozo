/**
 * VideoCallPage — selectors and interactions for /call/:bookingId.
 *
 * Mocks Daily.co / Edge Function calls so no real video infrastructure is
 * required during tests.
 */
export class VideoCallPage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  visit(bookingId: string, fanToken?: string): this {
    const url = fanToken
      ? `/call/${bookingId}?token=${fanToken}`
      : `/call/${bookingId}`;
    cy.visit(url);
    return this;
  }

  // ── Intercepts ─────────────────────────────────────────────────────────────

  interceptJoinCall(
    role: 'creator' | 'fan' = 'creator',
    alias = 'joinCall',
  ): this {
    cy.intercept('POST', /\/functions\/v1\/join-call/, {
      statusCode: 200,
      body: {
        room_url: 'https://convozo.daily.co/e2e-test-room',
        token: `mock-${role}-token`,
        booking: {
          id: 'mock-booking-id',
          status: 'confirmed',
          duration: 30,
          booker_name: 'E2E Call Tester',
          creator_name: 'Sarah Johnson',
          call_started_at: null,
        },
      },
    }).as(alias);
    return this;
  }

  interceptCompleteCall(alias = 'completeCall'): this {
    cy.intercept('POST', /\/functions\/v1\/complete-call/, {
      statusCode: 200,
      body: { status: 'completed' },
    }).as(alias);
    return this;
  }

  // ── Interactions ───────────────────────────────────────────────────────────

  clickEndCall(): this {
    cy.contains('button', /end call|end session/i, { timeout: 15000 }).click();
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  /** Asserts the room is in a loading / connecting / waiting state. */
  assertRoomLoading(): this {
    cy.get('body', { timeout: 10000 }).should(
      'satisfy',
      ($body: JQuery<HTMLBodyElement>) => {
        const text = $body.text().toLowerCase();
        return (
          text.includes('loading') ||
          text.includes('connecting') ||
          text.includes('waiting') ||
          text.includes('join')
        );
      },
    );
    return this;
  }

  assertCallEnded(): this {
    cy.contains(/call ended|session complete|thank you/i, {
      timeout: 10000,
    }).should('be.visible');
    return this;
  }

  assertStillOnCallPage(bookingId: string): this {
    cy.location('pathname', { timeout: 8000 }).should(
      'include',
      `/call/${bookingId}`,
    );
    return this;
  }
}

export const videoCallPage = new VideoCallPage();
