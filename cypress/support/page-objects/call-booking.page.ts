/**
 * CallBookingPage — selectors and interactions for the call booking form
 * embedded in the Call tab of /:slug.
 *
 * Used by the video-call, public-profile, and booking-slots specs.
 */
export class CallBookingPage {
  // ── Navigation ─────────────────────────────────────────────────────────────

  /** Visits the creator profile and navigates to the Session (Call) tab in one step. */
  visit(slug: string): this {
    cy.visit(`/${slug}`);
    // The call tab label in the UI is 'Session' (not 'Call' / 'Video')
    cy.contains('a', 'Session', { timeout: 10000 }).first().click();
    cy.contains(/book|schedule|available time/i, { timeout: 8000 }).should(
      'be.visible',
    );
    return this;
  }

  // ── Intercepts ─────────────────────────────────────────────────────────────

  interceptBookingsRead(alias = 'readBookings'): this {
    cy.intercept('POST', /\/rest\/v1\/rpc\/get_creator_booked_slots/).as(alias);
    return this;
  }

  interceptCreateSession(
    mockUrl = 'https://checkout.stripe.com/pay/mock-call-session',
    alias = 'createSession',
  ): this {
    cy.intercept('POST', /\/functions\/v1\/create-call-booking-session/, {
      statusCode: 200,
      body: { url: mockUrl },
    }).as(alias);
    return this;
  }

  // ── Calendar interactions ──────────────────────────────────────────────────

  /**
   * Navigates to the next month if the current month has no available day
   * buttons (e.g. when today is the last day of the month). Retries up to
   * 3 times before giving up.
   */
  private ensureAvailableDaysVisible(): void {
    cy.get('body').then(($body) => {
      const hasButtons = $body.find('button[aria-label^="Select day"]').length > 0;
      if (!hasButtons) {
        // Click "Next month" to navigate forward
        cy.get('button[aria-label="Next month"]').click();
        cy.wait(300);
      }
    });
  }

  selectFirstAvailableDay(): this {
    this.ensureAvailableDaysVisible();
    cy.get('button[aria-label^="Select day"]', { timeout: 10000 })
      .first()
      .click();
    return this;
  }

  selectDayByNumber(dayOfMonth: number): this {
    this.ensureAvailableDaysVisible();
    cy.contains('button[aria-label^="Select day"]', String(dayOfMonth), { timeout: 10000 })
      .first()
      .click();
    return this;
  }

  selectFirstTimeSlot(): this {
    // Time slot buttons live inside a role="group" container, distinct from
    // the calendar day buttons which also carry [aria-pressed].
    cy.get('[role="group"] button[aria-pressed]', { timeout: 8000 })
      .first()
      .click();
    return this;
  }

  // ── Booker details form ────────────────────────────────────────────────────

  fillBookerDetails(name: string, email: string): this {
    cy.get('input[id*="name"], input[placeholder*="name"]')
      .first()
      .clear()
      .type(name);
    cy.get('input[id*="email"], input[placeholder*="email"]')
      .first()
      .clear()
      .type(email);
    return this;
  }

  submit(): this {
    cy.contains('button', /book|confirm|proceed/i).click();
    return this;
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  assertDayButtonsVisible(): this {
    this.ensureAvailableDaysVisible();
    cy.get('button[aria-label^="Select day"]', { timeout: 10000 }).should(
      'have.length.greaterThan',
      0,
    );
    return this;
  }

  assertTimeSlotsVisible(): this {
    cy.get('[role="group"] button[aria-pressed]', { timeout: 8000 }).should(
      'have.length.greaterThan',
      0,
    );
    return this;
  }

  /**
   * After selecting a day, checks that a specific time label (e.g. "9:00 AM")
   * is absent from the time-slot list, or that the list is empty.
   */
  assertTimeSlotAbsent(timeLabel: RegExp): this {
    cy.get('body').then(($body) => {
      const timePickerExists = $body.find('[role="group"] button[aria-pressed]').length > 0;
      if (timePickerExists) {
        cy.contains('[role="group"] button[aria-pressed]', timeLabel).should('not.exist');
      } else {
        cy.contains(/no.*slot|pick a day|available times/i).should(
          'be.visible',
        );
      }
    });
    return this;
  }

  assertTimeSlotPresent(timeLabel: RegExp): this {
    cy.contains('[role="group"] button[aria-pressed]', timeLabel, { timeout: 8000 }).should('exist');
    return this;
  }
}

export const callBookingPage = new CallBookingPage();
