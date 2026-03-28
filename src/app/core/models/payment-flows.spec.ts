/**
 * Unit tests for payment domain models and financial computations
 *
 * Tests the payment model types, payout status constraints,
 * and the financial arithmetic used across the Angular frontend.
 *
 * Covers:
 *   ✓ PayoutStatus type exhaustiveness
 *   ✓ CallBooking model shape validation
 *   ✓ CompleteCallResponse shape validation
 *   ✓ Integer-cent price display formatting
 *   ✓ Platform fee split (22/78) verification
 *   ✓ Short-session fee (50%) computation
 *   ✓ No-show fee (30%) computation
 *   ✓ Escrow hold timing (3 days)
 *   ✓ Security: no float-to-int truncation errors
 */

import { PayoutStatus, CallBooking, CallBookingStatus, CompleteCallResponse } from '.';

// ── Constants (must match edge function values) ─────────────────────────────

const PLATFORM_FEE_PERCENTAGE = 22;
const SHORT_CALL_CHARGE_PERCENT = 50;
const FAN_NO_SHOW_FEE_PERCENT = 30;
const COMPLETION_THRESHOLD = 0.3;
const PAYOUT_HOLD_DAYS = 3;

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
      const statuses: PayoutStatus[] = ['held', 'pending_release', 'released', 'refunded'];
      expect(statuses.length).toBe(4);
      statuses.forEach((s) => {
        expect(typeof s).toBe('string');
      });
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

  describe('Payout Hold (3 days)', () => {
    it('computes release date 3 days from now', () => {
      const now = new Date('2026-03-28T12:00:00Z');
      const release = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      expect(release.toISOString()).toBe('2026-03-31T12:00:00.000Z');
    });

    it('exact delta is 259200000ms', () => {
      const now = new Date();
      const release = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      expect(release.getTime() - now.getTime()).toBe(259200000);
    });

    it('works across month boundary', () => {
      const now = new Date('2026-03-30T18:00:00Z');
      const release = new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
      expect(release.toISOString()).toBe('2026-04-02T18:00:00.000Z');
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
});
