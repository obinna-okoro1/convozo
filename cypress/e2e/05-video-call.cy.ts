/**
 * 05-video-call.cy.ts — Video call booking, joining, and ending
 *
 * Uses the seed booking from Alex Rodriguez (seed.sql) for dashboard and
 * video room tests. The booking form test mocks the Stripe checkout endpoint.
 * Only backend reads are for the booking ID and fan_access_token (behind RLS).
 */

import { callBookingPage, dashboardPage, publicProfilePage, videoCallPage } from '../support/page-objects';

export {};

const CREATOR_EMAIL = 'creator@example.com';
const CREATOR_PASS = 'sample123';
const CREATOR_SLUG = 'sarahjohnson';
const BOOKER_NAME = 'E2E Call Tester';
const BOOKER_EMAIL = 'e2e-call@convozo.test';

describe('Video Call — Booking & Room', () => {
  let bookingId: string;
  let fanAccessToken: string;

  before(() => {
    // Read the seed booking (Alex Rodriguez) from the DB
    cy.task<string>('readDbValue',
      `SELECT id FROM public.call_bookings WHERE booker_email = 'alex@example.com' LIMIT 1`,
    ).then((id) => {
      expect(id).to.be.a('string').and.not.be.empty;
      bookingId = id!;
    });

    cy.task<string>('readDbValue',
      `SELECT fan_access_token FROM public.call_bookings WHERE booker_email = 'alex@example.com' LIMIT 1`,
    ).then((token) => {
      expect(token).to.be.a('string').and.not.be.empty;
      fanAccessToken = token!;
    });
  });

  // ── Client: booking form UI ────────────────────────────────────────────────

  describe('Booking form (client perspective)', () => {
    it('shows the Call tab on the expert profile', () => {
      callBookingPage.visit(CREATOR_SLUG);
      cy.contains(/book session|video session|select a day|how it works/i, { timeout: 8000 }).should('be.visible');
    });

    it('shows day buttons on the calendar', () => {
      callBookingPage.visit(CREATOR_SLUG);
      callBookingPage.assertDayButtonsVisible();
    });

    it('selecting a slot and submitting redirects to checkout (mocked)', () => {
      callBookingPage.interceptCreateSession().visit(CREATOR_SLUG);
      callBookingPage.selectFirstAvailableDay().selectFirstTimeSlot();
      cy.get('input[id*="name"]').first().clear().type(BOOKER_NAME);
      cy.get('input[id*="email"]').first().clear().type(BOOKER_EMAIL);
      cy.contains('button', /book|confirm|proceed/i).click();
      cy.wait('@createSession').its('response.statusCode').should('eq', 200);
      cy.get('@createSession').its('response.body').should('have.property', 'url');
    });
  });

  // ── Expert dashboard — Bookings panel ─────────────────────────────────────

  describe('Expert dashboard — Bookings panel', () => {
    beforeEach(() => {
      cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    });

    it('shows the seed booking in the creator Bookings tab', () => {
      publicProfilePage.visit(CREATOR_SLUG).openManageDrawer();
      dashboardPage.clickBookingsTab();
      dashboardPage.assertBookingClientVisible('Alex Rodriguez');
      dashboardPage.assertConfirmedBadgeVisible();
    });
  });

  // ── Expert joins the call ──────────────────────────────────────────────────

  describe('Video room — Expert side', () => {
    beforeEach(() => {
      cy.loginAs(CREATOR_EMAIL, CREATOR_PASS);
    });

    it('loads the video room with a loading/waiting overlay', () => {
      videoCallPage.interceptJoinCall('creator').visit(bookingId);
      videoCallPage.assertRoomLoading();
    });

    it('Leave button navigates away from the call page', () => {
      videoCallPage.interceptJoinCall('creator').visit(bookingId);
      cy.contains('button', /leave/i, { timeout: 15000 }).click();
      cy.location('pathname', { timeout: 10000 }).should('not.include', `/call/${bookingId}`);
    });
  });

  // ── Client joins via fan_access_token ─────────────────────────────────────

  describe('Video room — Client (fan) side', () => {
    it('client can access the video room via fan_access_token query param', () => {
      videoCallPage.interceptJoinCall('fan', 'joinCallFan');
      videoCallPage.visit(bookingId, fanAccessToken);
      videoCallPage.assertStillOnCallPage(bookingId);
      videoCallPage.assertRoomLoading();
    });
  });
});
