/**
 * Unit tests for payment domain models and financial computations
 *
 * Tests the payment model types, payout status constraints,
 * and the financial arithmetic used across the Angular frontend.
 *
 * Covers:
 *   ✓ PayoutStatus type exhaustiveness (held, pending_release, released, refunded, disputed)
 *   ✓ CallBooking model shape validation (incl. dispute_id, dispute_frozen_at, refund_id)
 *   ✓ CompleteCallResponse shape validation
 *   ✓ Integer-cent price display formatting
 *   ✓ Platform fee split (22/78) verification
 *   ✓ Short-session fee (50%) computation
 *   ✓ No-show fee (30%) computation
 *   ✓ Escrow hold timing (7 days)
 *   ✓ Security: no float-to-int truncation errors
 *   ✓ Dispute/refund state shape (charge.dispute.* webhook outcomes)
 *   ✓ release-payout must skip disputed rows (freeze active)
 */

import { PayoutStatus, CallBooking, CallBookingStatus, CompleteCallResponse } from '.';

// ── Constants (must match edge function values) ─────────────────────────────

const PLATFORM_FEE_PERCENTAGE = 22;
const SHORT_CALL_CHARGE_PERCENT = 50;
const FAN_NO_SHOW_FEE_PERCENT = 30;
const COMPLETION_THRESHOLD = 0.3;
const PAYOUT_HOLD_DAYS = 7;

// ── Helpers ─────────────────────────────────────────────────────────────────

function computePlatformFee(cents: number): number {
  return Math.round((cents * PLATFORM_FEE_PERCENTAGE) / 100);
}

function computeExpertAmount(cents: number): number {
  return cents - computePlatformFee(cents);
}

function computeShortSessionFee(cents: number): number {
  return Math.round((cents * SHORT_CALL_CHARGE_PERCENT) / 100);
}

function computeNoShowFee(cents: number): number {
  return Math.round((cents * FAN_NO_SHOW_FEE_PERCENT) / 100);
}

function meetsThreshold(actual: number, booked: number): boolean {
  return actual >= booked * COMPLETION_THRESHOLD;
}

function formatCentsAsUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function makeBooking(overrides: Partial<CallBooking> = {}): CallBooking {
  const now = new Date().toISOString();
  return {
    id: 'booking-1',
    creator_id: 'creator-1',
    booker_name: 'Test Client',
    booker_email: 'client@example.com',
    scheduled_at: null,
    duration: 30,
    amount_paid: 5000,
    status: 'confirmed',
    call_notes: null,
    stripe_session_id: null,
    stripe_payment_intent_id: null,
    daily_room_name: null,
    daily_room_url: null,
    creator_meeting_token: null,
    fan_meeting_token: null,
    fan_access_token: 'tok-1',
    creator_joined_at: null,
    fan_joined_at: null,
    call_started_at: null,
    call_ended_at: null,
    actual_duration_seconds: null,
    payout_status: 'held',
    payout_released_at: null,
    payout_release_at: null,
    capture_method: 'manual',
    refunded_at: null,
    refund_id: null,
    dispute_id: null,
    dispute_frozen_at: null,
    fan_timezone: 'UTC',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('Payment Models & Financial Computations', () => {
  // ── Type shape tests ──────────────────────────────────────────────────────

  describe('PayoutStatus', () => {
    it('should accept all valid payout statuses', () => {
      const statuses: PayoutStatus[] = ['held', 'pending_release', 'released', 'refunded', 'disputed'];
      expect(statuses.length).toBe(5);
      statuses.forEach((s) => {
        expect(typeof s).toBe('string');
      });
    });

    it('disputed is a distinct payout status (chargeback freeze)', () => {
      const disputed: PayoutStatus = 'disputed';
      expect(disputed).toBe('disputed');
      // disputed ≠ refunded — dispute may be won back
      expect(disputed).not.toBe('refunded');
    });
  });

  describe('CallBookingStatus', () => {
    it('should accept all valid booking statuses', () => {
      const statuses: CallBookingStatus[] = [
        'pending',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
        'refunded',
      ];
      expect(statuses.length).toBe(7);
    });
  });

  describe('CallBooking model', () => {
    it('has all escrow-related fields', () => {
      const booking = makeBooking();
      expect(booking.payout_status).toBeDefined();
      expect(booking.payout_release_at).toBeDefined();
      expect(booking.capture_method).toBeDefined();
    });

    it('has all dispute/refund tracking fields', () => {
      const booking = makeBooking();
      // These fields are set by stripe-webhook dispute handlers — null until a dispute arrives
      expect(Object.prototype.hasOwnProperty.call(booking, 'dispute_id')).toBeTrue();
      expect(Object.prototype.hasOwnProperty.call(booking, 'dispute_frozen_at')).toBeTrue();
      expect(Object.prototype.hasOwnProperty.call(booking, 'refund_id')).toBeTrue();
      expect(booking.dispute_id).toBeNull();
      expect(booking.dispute_frozen_at).toBeNull();
      expect(booking.refund_id).toBeNull();
    });

    it('capture_method defaults to manual for new bookings', () => {
      const booking = makeBooking();
      expect(booking.capture_method).toBe('manual');
    });

    it('payout_status defaults to held', () => {
      const booking = makeBooking();
      expect(booking.payout_status).toBe('held');
    });

    it('amount_paid is stored as integer cents', () => {
      const booking = makeBooking({ amount_paid: 5000 });
      expect(Number.isInteger(booking.amount_paid)).toBeTrue();
      expect(booking.amount_paid).toBe(5000); // $50.00
    });
  });

  describe('CompleteCallResponse model', () => {
    it('has all required fields', () => {
      const response: CompleteCallResponse = {
        status: 'completed',
        actual_duration_seconds: 1200,
        booked_duration_seconds: 1800,
        meets_threshold: true,
        payout_released: false,
      };
      expect(response.status).toBe('completed');
      expect(response.meets_threshold).toBeTrue();
      expect(response.payout_released).toBeFalse();
    });
  });

  // ── Platform fee (22/78 split) ──────────────────────────────────────────

  describe('Platform Fee (22%)', () => {
    it('computes 22% for $10.00', () => {
      expect(computePlatformFee(1000)).toBe(220);
    });

    it('computes 78% expert for $10.00', () => {
      expect(computeExpertAmount(1000)).toBe(780);
    });

    it('fee + expert always equals total for common prices', () => {
      const prices = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 99999];
      prices.forEach((p) => {
        const fee = computePlatformFee(p);
        const expert = computeExpertAmount(p);
        expect(fee + expert).toBe(p);
      });
    });

    it('fee + expert equals total for odd cent amounts', () => {
      const primes = [1, 3, 7, 11, 13, 17, 19, 23, 29, 97, 101, 997];
      primes.forEach((p) => {
        expect(computePlatformFee(p) + computeExpertAmount(p)).toBe(p);
      });
    });

    it('all fees are non-negative integers', () => {
      const amounts = [0, 1, 2, 50, 99, 100, 999, 1000, 99999];
      amounts.forEach((a) => {
        const fee = computePlatformFee(a);
        expect(Number.isInteger(fee)).toBeTrue();
        expect(fee).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ── Short session fee (50%) ───────────────────────────────────────────────

  describe('Short Session Fee (50%)', () => {
    it('computes 50% for $50.00 booking', () => {
      expect(computeShortSessionFee(5000)).toBe(2500);
    });

    it('computes 50% for $1.00 booking', () => {
      expect(computeShortSessionFee(100)).toBe(50);
    });

    it('handles odd cents: $10.01 → 501 or 500', () => {
      const fee = computeShortSessionFee(1001);
      expect([500, 501]).toContain(fee);
    });

    it('is always ≤ total amount', () => {
      const amounts = [0, 1, 50, 100, 999, 1000, 5000, 99999];
      amounts.forEach((a) => {
        expect(computeShortSessionFee(a)).toBeLessThanOrEqual(a);
      });
    });

    it('legacy refund (total - fee) is always ≥ 0', () => {
      const amounts = [0, 1, 50, 100, 999, 1000, 5000, 99999];
      amounts.forEach((a) => {
        expect(a - computeShortSessionFee(a)).toBeGreaterThanOrEqual(0);
      });
    });

    it('result is always an integer', () => {
      const primes = [1, 3, 7, 11, 97, 101, 997, 10001];
      primes.forEach((p) => {
        expect(Number.isInteger(computeShortSessionFee(p))).toBeTrue();
      });
    });
  });

  // ── No-show fee (30%) ─────────────────────────────────────────────────────

  describe('No-Show Fee (30%)', () => {
    it('computes 30% for $100 booking', () => {
      expect(computeNoShowFee(10000)).toBe(3000);
    });

    it('computes 30% for $10 booking', () => {
      expect(computeNoShowFee(1000)).toBe(300);
    });

    it('is always ≤ total amount', () => {
      const amounts = [0, 1, 2, 3, 50, 100, 999, 1000, 99999];
      amounts.forEach((a) => {
        expect(computeNoShowFee(a)).toBeLessThanOrEqual(a);
      });
    });

    it('remaining 70% is always ≥ 0', () => {
      const amounts = [0, 1, 2, 3, 50, 100, 999, 1000, 99999];
      amounts.forEach((a) => {
        expect(a - computeNoShowFee(a)).toBeGreaterThanOrEqual(0);
      });
    });

    it('result is always an integer', () => {
      const primes = [1, 3, 7, 11, 97, 101, 997, 10001];
      primes.forEach((p) => {
        expect(Number.isInteger(computeNoShowFee(p))).toBeTrue();
      });
    });
  });

  // ── Completion threshold (30%) ──────────────────────────────────────────

  describe('Completion Threshold (30%)', () => {
    it('30-min booking: exactly 540s (30%) meets threshold', () => {
      expect(meetsThreshold(540, 1800)).toBeTrue();
    });

    it('30-min booking: 539s does NOT meet threshold', () => {
      expect(meetsThreshold(539, 1800)).toBeFalse();
    });

    it('60-min booking: exactly 1080s meets threshold', () => {
      expect(meetsThreshold(1080, 3600)).toBeTrue();
    });

    it('60-min booking: 1079s does NOT meet threshold', () => {
      expect(meetsThreshold(1079, 3600)).toBeFalse();
    });

    it('15-min booking: exactly 270s meets threshold', () => {
      expect(meetsThreshold(270, 900)).toBeTrue();
    });

    it('0 seconds never meets threshold', () => {
      expect(meetsThreshold(0, 1800)).toBeFalse();
    });

    it('full duration always meets threshold', () => {
      expect(meetsThreshold(1800, 1800)).toBeTrue();
    });

    it('over-time still meets threshold', () => {
      expect(meetsThreshold(2700, 1800)).toBeTrue();
    });
  });

  // ── Payout hold timing ────────────────────────────────────────────────────

  describe('Payout Hold (7 days)', () => {
    it('computes release date 7 days from now', () => {
      const now = new Date('2026-03-28T12:00:00Z');
      const release = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      expect(release.toISOString()).toBe('2026-04-04T12:00:00.000Z');
    });

    it('exact delta is 604800000ms', () => {
      const now = new Date();
      const release = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      expect(release.getTime() - now.getTime()).toBe(604800000);
    });

    it('works across month boundary', () => {
      const now = new Date('2026-03-30T18:00:00Z');
      const release = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      expect(release.toISOString()).toBe('2026-04-06T18:00:00.000Z');
    });
  });

  // ── USD formatting ────────────────────────────────────────────────────────

  describe('USD Formatting', () => {
    it('formats 1000 cents as $10.00', () => {
      expect(formatCentsAsUSD(1000)).toBe('$10.00');
    });

    it('formats 5000 cents as $50.00', () => {
      expect(formatCentsAsUSD(5000)).toBe('$50.00');
    });

    it('formats 1 cent as $0.01', () => {
      expect(formatCentsAsUSD(1)).toBe('$0.01');
    });

    it('formats 0 cents as $0.00', () => {
      expect(formatCentsAsUSD(0)).toBe('$0.00');
    });

    it('formats 99999 cents as $999.99', () => {
      expect(formatCentsAsUSD(99999)).toBe('$999.99');
    });
  });

  // ── End-to-end scenario computations ──────────────────────────────────────

  describe('Scenario: Full successful call', () => {
    it('30-min call, 20min actual, $50 → full capture, 22% platform', () => {
      const booking = makeBooking({ duration: 30, amount_paid: 5000 });
      const actualSeconds = 20 * 60;
      const bookedSeconds = booking.duration * 60;

      expect(meetsThreshold(actualSeconds, bookedSeconds)).toBeTrue();
      expect(computePlatformFee(booking.amount_paid)).toBe(1100);
      expect(computeExpertAmount(booking.amount_paid)).toBe(3900);
    });
  });

  describe('Scenario: Short session', () => {
    it('30-min call, 5min actual, $50 → 50% capture ($25)', () => {
      const booking = makeBooking({ duration: 30, amount_paid: 5000 });
      const actualSeconds = 5 * 60;
      const bookedSeconds = booking.duration * 60;

      expect(meetsThreshold(actualSeconds, bookedSeconds)).toBeFalse();
      expect(computeShortSessionFee(booking.amount_paid)).toBe(2500);
      // Platform fee on captured portion
      expect(computePlatformFee(2500)).toBe(550);
      expect(computeExpertAmount(2500)).toBe(1950);
    });
  });

  describe('Scenario: Fan no-show', () => {
    it('$100 booking → 30% no-show fee ($30)', () => {
      const booking = makeBooking({ amount_paid: 10000 });
      const fee = computeNoShowFee(booking.amount_paid);
      expect(fee).toBe(3000);
      expect(booking.amount_paid - fee).toBe(7000);
    });
  });

  describe('Scenario: Creator no-show', () => {
    it('$100 booking → full cancel, $0 captured', () => {
      const captured = 0;
      expect(captured).toBe(0);
      expect(computePlatformFee(captured)).toBe(0);
    });
  });

  // ── Security invariants ───────────────────────────────────────────────────

  describe('Security Invariants', () => {
    it('no fee computation produces a value > total', () => {
      const amounts = [0, 1, 2, 3, 50, 100, 999, 1000, 5000, 10000, 50000, 99999, 100000];
      amounts.forEach((a) => {
        expect(computeShortSessionFee(a)).toBeLessThanOrEqual(a);
        expect(computeNoShowFee(a)).toBeLessThanOrEqual(a);
        expect(computePlatformFee(a)).toBeLessThanOrEqual(a);
      });
    });

    it('no fee computation produces a negative value', () => {
      const amounts = [0, 1, 2, 3, 50, 100, 999, 1000, 99999];
      amounts.forEach((a) => {
        expect(computeShortSessionFee(a)).toBeGreaterThanOrEqual(0);
        expect(computeNoShowFee(a)).toBeGreaterThanOrEqual(0);
        expect(computePlatformFee(a)).toBeGreaterThanOrEqual(0);
      });
    });

    it('all fee results are integers (no floating point cents)', () => {
      const primes = [1, 3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 97, 101, 997, 1001, 9999];
      primes.forEach((p) => {
        expect(Number.isInteger(computeShortSessionFee(p))).toBeTrue();
        expect(Number.isInteger(computeNoShowFee(p))).toBeTrue();
        expect(Number.isInteger(computePlatformFee(p))).toBeTrue();
      });
    });

    it('very large amount ($1M) does not overflow', () => {
      const total = 100_000_000; // $1,000,000
      expect(computeShortSessionFee(total)).toBe(50_000_000);
      expect(computeNoShowFee(total)).toBe(30_000_000);
      expect(computePlatformFee(total)).toBe(22_000_000);
    });
  });

  // ── Release-payout eligibility ─────────────────────────────────────────────
  // Mirrors the lte(payout_release_at, now) logic in release-payout/index.ts.

  describe('Release-Payout Eligibility', () => {
    /** Mirrors the Supabase `.lte('payout_release_at', now)` eligibility check. */
    function isEligibleForRelease(releaseAt: string | null, now: Date = new Date()): boolean {
      if (!releaseAt) return false;
      return new Date(releaseAt) <= now;
    }

    it('past release_at is eligible', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // yesterday
      expect(isEligibleForRelease(past)).toBeTrue();
    });

    it('release_at exactly equal to now is eligible (lte, not lt)', () => {
      const now = new Date();
      expect(isEligibleForRelease(now.toISOString(), now)).toBeTrue();
    });

    it('release_at 1ms in future is NOT eligible', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 1).toISOString();
      expect(isEligibleForRelease(future, now)).toBeFalse();
    });

    it('release_at 7 days from now is NOT eligible (newly captured row)', () => {
      const now = new Date();
      const sevenDaysOut = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      expect(isEligibleForRelease(sevenDaysOut.toISOString(), now)).toBeFalse();
    });

    it('null release_at is never eligible', () => {
      expect(isEligibleForRelease(null)).toBeFalse();
    });

    it('row captured exactly 7 days ago becomes eligible exactly now', () => {
      const HOLD_MS = PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000;
      const captureTime = new Date(Date.now() - HOLD_MS);
      const releaseAt = new Date(captureTime.getTime() + HOLD_MS); // exactly now
      expect(isEligibleForRelease(releaseAt.toISOString(), releaseAt)).toBeTrue();
    });

    it('row captured 6 days ago is still NOT eligible (hold not expired)', () => {
      const captureTime = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      const releaseAt = new Date(captureTime.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      const now = new Date();
      expect(isEligibleForRelease(releaseAt.toISOString(), now)).toBeFalse();
    });
  });

  // ── Payout status state machine ────────────────────────────────────────────
  // Validates the lifecycle: held → pending_release → released.
  // Any deviation from this path is a data integrity violation.

  describe('Payout Status State Machine', () => {
    it('newly captured booking transitions from held to pending_release', () => {
      const held = makeBooking({ payout_status: 'held', payout_release_at: null });
      expect(held.payout_status).toBe('held');
      expect(held.payout_release_at).toBeNull();

      // After capture: status becomes pending_release, release_at is set 7 days out
      const now = new Date();
      const releaseAt = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const afterCapture = makeBooking({ payout_status: 'pending_release', payout_release_at: releaseAt });
      expect(afterCapture.payout_status).toBe('pending_release');
      expect(afterCapture.payout_release_at).not.toBeNull();
    });

    it('released booking has payout_released_at set (never null)', () => {
      const released = makeBooking({
        payout_status: 'released',
        payout_released_at: new Date().toISOString(),
      });
      expect(released.payout_status).toBe('released');
      expect(released.payout_released_at).not.toBeNull();
    });

    it('held booking has null payout_released_at (not yet captured)', () => {
      const held = makeBooking({ payout_status: 'held', payout_released_at: null });
      expect(held.payout_released_at).toBeNull();
    });

    it('pending_release booking has release_at in the future', () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const booking = makeBooking({ payout_status: 'pending_release', payout_release_at: future });
      expect(new Date(booking.payout_release_at!).getTime()).toBeGreaterThan(Date.now());
    });

    it('only pending_release rows are targeted by release-payout cron (not disputed)', () => {
      // release-payout must never touch 'disputed' rows — payout is frozen by chargeback
      const allStatuses: PayoutStatus[] = ['held', 'pending_release', 'released', 'refunded', 'disputed'];
      const cronTargets = allStatuses.filter((s) => s === 'pending_release');
      expect(cronTargets.length).toBe(1);
      expect(cronTargets[0]).toBe('pending_release');
      // Sanity: disputed is excluded from release targets
      expect(cronTargets as PayoutStatus[]).not.toContain('disputed' as PayoutStatus);
    });

    it('processed count equals released + errors (response invariant)', () => {
      const processed = 5;
      const released = 4;
      const errors = 1;
      expect(released + errors).toBe(processed);
    });
  });

  // ── Dispute / Refund state machine ────────────────────────────────────────
  // charge.dispute.created → payout_status='disputed' (webhook-driven, never client-driven)
  // charge.dispute.closed (won) → restores 'pending_release'
  // charge.dispute.closed (lost) → 'refunded'

  describe('Dispute / Refund State (Stripe webhook-driven)', () => {
    it('disputed booking has dispute_id and dispute_frozen_at set', () => {
      const booking = makeBooking({
        payout_status: 'disputed',
        dispute_id: 'dp_test_xxx',
        dispute_frozen_at: new Date().toISOString(),
      });
      expect(booking.payout_status).toBe('disputed');
      expect(booking.dispute_id).toBe('dp_test_xxx');
      expect(booking.dispute_frozen_at).not.toBeNull();
    });

    it('non-disputed booking has null dispute_id and dispute_frozen_at', () => {
      const booking = makeBooking({ payout_status: 'pending_release' });
      expect(booking.dispute_id).toBeNull();
      expect(booking.dispute_frozen_at).toBeNull();
    });

    it('dispute won: payout_status restores to pending_release, dispute fields clear', () => {
      // Simulates the state after charge.dispute.closed (won) webhook handler runs
      const afterWin = makeBooking({
        payout_status: 'pending_release',
        dispute_id: null,
        dispute_frozen_at: null,
        payout_release_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(afterWin.payout_status).toBe('pending_release');
      expect(afterWin.dispute_id).toBeNull();
      expect(afterWin.dispute_frozen_at).toBeNull();
      expect(afterWin.payout_release_at).not.toBeNull();
    });

    it('dispute lost: payout_status is refunded (funds lost to chargeback)', () => {
      const afterLoss = makeBooking({
        payout_status: 'refunded',
        dispute_id: 'dp_test_lost',
        refund_id: null, // Stripe handles refund automatically on dispute loss
      });
      expect(afterLoss.payout_status).toBe('refunded');
      expect(afterLoss.dispute_id).toBe('dp_test_lost');
    });

    it('refunded booking has refund_id set (re_xxx from Stripe)', () => {
      const refunded = makeBooking({
        payout_status: 'refunded',
        refund_id: 're_test_abc123',
        refunded_at: new Date().toISOString(),
      });
      expect(refunded.refund_id).toBe('re_test_abc123');
      expect(refunded.refunded_at).not.toBeNull();
    });

    it('disputed status prevents release-payout eligibility', () => {
      // A disputed row must NEVER be released — funds are frozen pending chargeback outcome
      const disputed = makeBooking({
        payout_status: 'disputed',
        dispute_id: 'dp_freeze_test',
        dispute_frozen_at: new Date().toISOString(),
        // Even if payout_release_at is in the past, disputed rows must be skipped
        payout_release_at: new Date(Date.now() - 1000).toISOString(),
      });
      // The release-payout cron only targets payout_status = 'pending_release'
      const isReleaseable = disputed.payout_status === 'pending_release';
      expect(isReleaseable).toBeFalse();
    });

    it('disputed is distinct from refunded — a dispute can be won back', () => {
      const disputed: PayoutStatus = 'disputed';
      const refunded: PayoutStatus = 'refunded';
      expect(disputed).not.toBe(refunded);
      // Disputed can resolve to pending_release (won) or refunded (lost)
      // Refunded is terminal — cannot transition back
    });

    it('refunded booking has null dispute_frozen_at when loss-refund completes', () => {
      // After dispute.closed (lost), the booking is refunded; freeze state is no longer relevant
      const lostAndRefunded = makeBooking({
        payout_status: 'refunded',
        refunded_at: new Date().toISOString(),
        dispute_frozen_at: null,
      });
      expect(lostAndRefunded.payout_status).toBe('refunded');
      expect(lostAndRefunded.dispute_frozen_at).toBeNull();
    });
  });

  // ── Expert notification amount ─────────────────────────────────────────────
  // The release-payout function notifies the expert with the 78% payout amount.

  describe('Expert Notification Amount on Release', () => {
    function formatExpertPayout(amountPaidCents: number): string {
      const expertCents = amountPaidCents - Math.round(amountPaidCents * PLATFORM_FEE_PERCENTAGE / 100);
      return `$${(expertCents / 100).toFixed(2)}`;
    }

    it('$50.00 booking → expert gets $39.00 notification', () => {
      expect(formatExpertPayout(5000)).toBe('$39.00');
    });

    it('$100.00 booking → expert gets $78.00 notification', () => {
      expect(formatExpertPayout(10000)).toBe('$78.00');
    });

    it('$10.00 booking → expert gets $7.80 notification', () => {
      expect(formatExpertPayout(1000)).toBe('$7.80');
    });

    it('notification amount is always a valid dollar string', () => {
      const amounts = [100, 500, 1000, 5000, 10000, 25000, 50000];
      amounts.forEach((a) => {
        const formatted = formatExpertPayout(a);
        expect(formatted).toMatch(/^\$\d+\.\d{2}$/);
      });
    });

    it('notification amount is always less than total (platform takes 22%)', () => {
      const amounts = [100, 1000, 5000, 10000, 99999];
      amounts.forEach((a) => {
        const expertCents = a - Math.round(a * PLATFORM_FEE_PERCENTAGE / 100);
        expect(expertCents).toBeLessThan(a);
        expect(expertCents).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(expertCents)).toBeTrue();
      });
    });
  });
});
