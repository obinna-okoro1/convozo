/**
 * 09-call-booking-slots.cy.ts — Call booking slot management
 *
 * Uses seed availability data (Mon–Fri 9–12, 14–17 for sarahjohnson).
 * Seeds call bookings only for slot-conflict tests (extreme case —
 * can't create bookings through UI without Stripe payment).
 */

import { callBookingPage, dashboardPage, publicProfilePage } from '../support/page-objects';

export {};

const CREATOR_SLUG = 'sarahjohnson';
const CREATOR_EMAIL = 'creator@example.com';
const CREATOR_PASS = 'sample123';

// Known creator ID from seed.sql
const CREATOR_ID = '33333333-3333-3333-3333-333333333333';

// ── Helper: find the Nth business day (Mon–Fri) from today ──────────────────
// Counts actual weekdays, so nextWeekdayIso(N) and nextWeekdayIso(N+1) are
// always different calendar dates regardless of the starting day of the week.
function nextWeekdayIso(businessDaysAhead = 1): { iso: string; dow: number; dayOfMonth: number } {
  const d = new Date();
  let count = 0;
  while (count < businessDaysAhead) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  d.setHours(9, 0, 0, 0); // 09:00 — within the creator's availability window
  return { iso: d.toISOString(), dow: d.getDay(), dayOfMonth: d.getDate() };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Call Booking — Slot Management', () => {
  before(() => {
    // Cancel any leftover test bookings from previous runs
    cy.task('cleanupTestBookings', CREATOR_ID);
  });

  // ── 1. Slot picker renders ────────────────────────────────────────────────

  it('shows available days and time slots on the booking form', () => {
    callBookingPage.visit(CREATOR_SLUG);
    callBookingPage.assertDayButtonsVisible();
  });

  it('shows time slots after clicking an available day', () => {
    callBookingPage.visit(CREATOR_SLUG).selectFirstAvailableDay();
    callBookingPage.assertTimeSlotsVisible();
  });

  // ── 2. Happy-path booking submission ──────────────────────────────────────

  it('submits the booking form and calls the Edge Function', () => {
    callBookingPage.interceptCreateSession().visit(CREATOR_SLUG);
    callBookingPage.selectFirstAvailableDay().selectFirstTimeSlot();
    callBookingPage.fillBookerDetails('Booking Tester', 'booking-tester@convozo.test').submit();

    cy.wait('@createSession').its('request.body').should((body: unknown) => {
      const b = body as Record<string, unknown>;
      expect(b).to.have.property('scheduled_at');
      expect(b).to.have.property('creator_slug', CREATOR_SLUG);
    });
  });

  // ── 3. Already-booked slot is hidden from a second visitor ────────────────

  describe('Booked slot hidden from second visitor', () => {
    let bookedIso: string;
    let bookedDayOfMonth: number;
    let seedBookingId: string;

    before(() => {
      const nw = nextWeekdayIso(2);
      bookedIso = nw.iso;
      bookedDayOfMonth = nw.dayOfMonth;

      // EXTREME CASE: seed a confirmed booking (can't pay via Stripe in E2E)
      cy.task<{ id: string; fanAccessToken: string }>('seedCallBooking', {
        creatorId: CREATOR_ID,
        bookerName: 'First Booker',
        bookerEmail: 'first-booker@convozo.test',
        scheduledAt: bookedIso,
        status: 'confirmed',
        amountPaid: 5000,
      }).then((booking) => {
        seedBookingId = booking.id;
      });
    });

    after(() => {
      cy.task('cancelBooking', seedBookingId);
    });

    it('the booked ISO is not offered as a time slot to a second visitor', () => {
      callBookingPage.interceptBookingsRead().visit(CREATOR_SLUG);
      cy.wait('@readBookings');

      callBookingPage.selectDayByNumber(bookedDayOfMonth);
      callBookingPage.assertTimeSlotAbsent(/9:00 am/i);
    });
  });

  // ── 4. Cancelled booking releases the slot ────────────────────────────────

  describe('Cancelled slot becomes available again', () => {
    let cancelledDayOfMonth: number;

    before(() => {
      const nw = nextWeekdayIso(5);
      cancelledDayOfMonth = nw.dayOfMonth;

      // Seed a booking, then cancel it immediately
      cy.task<{ id: string; fanAccessToken: string }>('seedCallBooking', {
        creatorId: CREATOR_ID,
        bookerName: 'Soon Cancelled',
        bookerEmail: 'cancelled@convozo.test',
        scheduledAt: nw.iso,
        status: 'confirmed',
        amountPaid: 5000,
      }).then((booking) => {
        cy.task('cancelBooking', booking.id);
      });
    });

    it('a cancelled booking slot is available again in the form', () => {
      callBookingPage.interceptBookingsRead().visit(CREATOR_SLUG);
      cy.wait('@readBookings');

      callBookingPage.selectDayByNumber(cancelledDayOfMonth);
      callBookingPage.assertTimeSlotPresent(/9:00 am/i);
    });
  });

  // ── 5. Edge Function rejects a concurrent double-book ─────────────────────

  it('Edge Function returns an error when the slot is already taken', () => {
    const { iso } = nextWeekdayIso(4);

    cy.task('seedCallBooking', {
      creatorId: CREATOR_ID,
      bookerName: 'Prior Booker',
      bookerEmail: 'prior@convozo.test',
      scheduledAt: iso,
      status: 'confirmed',
      amountPaid: 5000,
    });

    cy.request({
      method: 'POST',
      url: `${Cypress.env('supabaseUrl') as string}/functions/v1/create-call-booking-session`,
      headers: {
        apikey: Cypress.env('supabaseAnonKey') as string,
        'Content-Type': 'application/json',
      },
      body: {
        creator_slug: CREATOR_SLUG,
        booker_name: 'Second Client',
        booker_email: 'second-client@convozo.test',
        scheduled_at: iso,
        timezone: 'UTC',
        duration: 30,
        price: 5000,
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([400, 409, 422, 500]);
      const body = res.body as Record<string, unknown>;
      expect(body).to.have.property('error');
    });
  });

  // ── 6. Creator sees the booking in their dashboard ─────────────────────────

  it('creator dashboard Bookings panel shows a confirmed booking', () => {
    // Use the seed booking from Alex Rodriguez (already in seed.sql)
    cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    publicProfilePage.visit(CREATOR_SLUG).openManageDrawer();
    dashboardPage.clickBookingsTab();
    dashboardPage.assertBookingClientVisible('Alex Rodriguez');
    dashboardPage.assertConfirmedBadgeVisible();
  });
});
