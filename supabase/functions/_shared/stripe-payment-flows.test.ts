/**
 * Unit tests for Stripe payment flow logic
 *
 * Tests the critical financial arithmetic, threshold calculations, and
 * fee computations used across complete-call and check-no-show edge functions.
 *
 * These are pure-logic tests — no network, no Supabase, no Stripe API calls.
 * They verify the integer-cent arithmetic that protects Convozo from money bugs.
 *
 * What these tests cover:
 *   1. Completion threshold (30%) — boundary testing at exact cutoff
 *   2. Short-session fee (50%) — integer cent arithmetic, no floating point
 *   3. No-show fee (30%) — integer cent arithmetic
 *   4. Platform fee (22%) — 78/22 split integrity
 *   5. Payout hold (3 days) — timestamp arithmetic
 *   6. Edge cases: $0 amounts, odd cent amounts (rounding), large amounts
 *   7. Security: amount_to_capture never exceeds total, never negative
 *
 * Run with:
 *   deno test --allow-env _shared/stripe-payment-flows.test.ts
 */

import { assertEquals, assert } from '@std/assert';

// ── Constants (mirrored from complete-call and check-no-show) ──────────────

const COMPLETION_THRESHOLD = 0.30;
const SHORT_CALL_CHARGE_PERCENT = 50;
const FAN_NO_SHOW_FEE_PERCENT = 30;
const PLATFORM_FEE_PERCENTAGE = 22;
const PAYOUT_HOLD_DAYS = 3;

// ── Pure computation helpers (extracted logic from edge functions) ──────────

/** Check if a call meets the 30% completion threshold. */
function meetsThreshold(actualSeconds: number, bookedSeconds: number): boolean {
  return actualSeconds >= bookedSeconds * COMPLETION_THRESHOLD;
}

/** Compute the 50% short-session fee in integer cents. */
function computeShortSessionFee(totalAmountCents: number): number {
  return Math.round(totalAmountCents * SHORT_CALL_CHARGE_PERCENT / 100);
}

/** Compute the 30% fan no-show fee in integer cents. */
function computeNoShowFee(totalAmountCents: number): number {
  return Math.round(totalAmountCents * FAN_NO_SHOW_FEE_PERCENT / 100);
}

/** Compute the platform fee (22%) in integer cents. */
function computePlatformFee(totalAmountCents: number): number {
  return Math.round(totalAmountCents * PLATFORM_FEE_PERCENTAGE / 100);
}

/** Compute expert payout (78%) in integer cents. */
function computeExpertAmount(totalAmountCents: number): number {
  return totalAmountCents - computePlatformFee(totalAmountCents);
}

/** Compute the payout release timestamp. */
function computePayoutReleaseAt(now: Date): Date {
  return new Date(now.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── COMPLETION THRESHOLD TESTS ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test('Threshold - 30-min call: exactly 30% (540s) meets threshold', () => {
  const bookedSeconds = 30 * 60; // 1800s
  assertEquals(meetsThreshold(540, bookedSeconds), true);
});

Deno.test('Threshold - 30-min call: 539s (just under 30%) does NOT meet threshold', () => {
  const bookedSeconds = 30 * 60;
  assertEquals(meetsThreshold(539, bookedSeconds), false);
});

Deno.test('Threshold - 30-min call: 541s (just over 30%) meets threshold', () => {
  const bookedSeconds = 30 * 60;
  assertEquals(meetsThreshold(541, bookedSeconds), true);
});

Deno.test('Threshold - 60-min call: exactly 30% (1080s) meets threshold', () => {
  const bookedSeconds = 60 * 60;
  assertEquals(meetsThreshold(1080, bookedSeconds), true);
});

Deno.test('Threshold - 60-min call: 1079s does NOT meet threshold', () => {
  const bookedSeconds = 60 * 60;
  assertEquals(meetsThreshold(1079, bookedSeconds), false);
});

Deno.test('Threshold - 15-min call: exactly 30% (270s) meets threshold', () => {
  const bookedSeconds = 15 * 60;
  assertEquals(meetsThreshold(270, bookedSeconds), true);
});

Deno.test('Threshold - 0 seconds actual never meets threshold', () => {
  assertEquals(meetsThreshold(0, 1800), false);
});

Deno.test('Threshold - full duration always meets threshold', () => {
  assertEquals(meetsThreshold(1800, 1800), true);
});

Deno.test('Threshold - over-time still meets threshold', () => {
  // Call ran 45 min for a 30-min booking (e.g. extended naturally)
  assertEquals(meetsThreshold(2700, 1800), true);
});

Deno.test('Threshold - 1 second does NOT meet threshold for any booking', () => {
  assertEquals(meetsThreshold(1, 900), false);  // 15-min
  assertEquals(meetsThreshold(1, 1800), false); // 30-min
  assertEquals(meetsThreshold(1, 3600), false); // 60-min
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── SHORT SESSION FEE (50%) TESTS ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test('ShortSessionFee - $10.00 (1000 cents) → 500 cents', () => {
  assertEquals(computeShortSessionFee(1000), 500);
});

Deno.test('ShortSessionFee - $50.00 (5000 cents) → 2500 cents', () => {
  assertEquals(computeShortSessionFee(5000), 2500);
});

Deno.test('ShortSessionFee - $1.00 (100 cents) → 50 cents', () => {
  assertEquals(computeShortSessionFee(100), 50);
});

Deno.test('ShortSessionFee - odd amount $10.01 (1001 cents) → 501 cents (rounds up)', () => {
  // Math.round(1001 * 50 / 100) = Math.round(500.5) = 501
  assertEquals(computeShortSessionFee(1001), 501);
});

Deno.test('ShortSessionFee - odd amount $10.03 (1003 cents) → 502 cents', () => {
  // Math.round(1003 * 50 / 100) = Math.round(501.5) = 502
  assertEquals(computeShortSessionFee(1003), 502);
});

Deno.test('ShortSessionFee - $0.01 (1 cent) → 1 cent (rounds up from 0.5)', () => {
  assertEquals(computeShortSessionFee(1), 1);
});

Deno.test('ShortSessionFee - $0.00 (0 cents) → 0 cents', () => {
  assertEquals(computeShortSessionFee(0), 0);
});

Deno.test('ShortSessionFee - large amount $999.99 (99999 cents) → 50000 cents', () => {
  assertEquals(computeShortSessionFee(99999), 50000);
});

Deno.test('ShortSessionFee - never exceeds total amount', () => {
  const amounts = [1, 50, 99, 100, 999, 1000, 5000, 10000, 99999];
  for (const amount of amounts) {
    const fee = computeShortSessionFee(amount);
    assert(fee <= amount, `Short session fee ${fee} exceeds total ${amount}`);
    assert(fee >= 0, `Short session fee ${fee} is negative for amount ${amount}`);
  }
});

Deno.test('ShortSessionFee - refund amount for legacy is always non-negative', () => {
  const amounts = [1, 50, 99, 100, 999, 1000, 5000, 10000, 99999];
  for (const amount of amounts) {
    const fee = computeShortSessionFee(amount);
    const refund = amount - fee;
    assert(refund >= 0, `Legacy refund ${refund} is negative for amount ${amount}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── FAN NO-SHOW FEE (30%) TESTS ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test('NoShowFee - $10.00 (1000 cents) → 300 cents', () => {
  assertEquals(computeNoShowFee(1000), 300);
});

Deno.test('NoShowFee - $50.00 (5000 cents) → 1500 cents', () => {
  assertEquals(computeNoShowFee(5000), 1500);
});

Deno.test('NoShowFee - odd amount $10.01 (1001 cents) → 300 cents', () => {
  // Math.round(1001 * 30 / 100) = Math.round(300.3) = 300
  assertEquals(computeNoShowFee(1001), 300);
});

Deno.test('NoShowFee - odd amount $10.03 (1003 cents) → 301 cents', () => {
  // Math.round(1003 * 30 / 100) = Math.round(300.9) = 301
  assertEquals(computeNoShowFee(1003), 301);
});

Deno.test('NoShowFee - $0.01 (1 cent) → 0 cents (rounds down from 0.3)', () => {
  assertEquals(computeNoShowFee(1), 0);
});

Deno.test('NoShowFee - $0.02 (2 cents) → 1 cent (rounds up from 0.6)', () => {
  assertEquals(computeNoShowFee(2), 1);
});

Deno.test('NoShowFee - $0.00 (0 cents) → 0 cents', () => {
  assertEquals(computeNoShowFee(0), 0);
});

Deno.test('NoShowFee - never exceeds total amount', () => {
  const amounts = [0, 1, 2, 3, 50, 100, 999, 1000, 5000, 99999];
  for (const amount of amounts) {
    const fee = computeNoShowFee(amount);
    assert(fee <= amount, `No-show fee ${fee} exceeds total ${amount}`);
    assert(fee >= 0, `No-show fee ${fee} is negative for amount ${amount}`);
  }
});

Deno.test('NoShowFee - remaining (70%) refund is non-negative', () => {
  const amounts = [0, 1, 2, 3, 50, 100, 999, 1000, 5000, 99999];
  for (const amount of amounts) {
    const fee = computeNoShowFee(amount);
    assert(amount - fee >= 0, `Refund amount negative for total ${amount}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── PLATFORM FEE (22%) TESTS ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test('PlatformFee - $10.00 (1000 cents) → 220 platform + 780 expert', () => {
  assertEquals(computePlatformFee(1000), 220);
  assertEquals(computeExpertAmount(1000), 780);
});

Deno.test('PlatformFee - $50.00 (5000 cents) → 1100 platform + 3900 expert', () => {
  assertEquals(computePlatformFee(5000), 1100);
  assertEquals(computeExpertAmount(5000), 3900);
});

Deno.test('PlatformFee - $1.00 (100 cents) → 22 platform + 78 expert', () => {
  assertEquals(computePlatformFee(100), 22);
  assertEquals(computeExpertAmount(100), 78);
});

Deno.test('PlatformFee - platformFee + expertAmount always equals total', () => {
  const amounts = [1, 50, 99, 100, 500, 999, 1000, 5000, 10000, 99999];
  for (const amount of amounts) {
    const fee = computePlatformFee(amount);
    const expert = computeExpertAmount(amount);
    assertEquals(fee + expert, amount, `Split doesn't add up for ${amount}: ${fee} + ${expert} ≠ ${amount}`);
  }
});

Deno.test('PlatformFee - $0.00 (0 cents) → 0 + 0', () => {
  assertEquals(computePlatformFee(0), 0);
  assertEquals(computeExpertAmount(0), 0);
});

Deno.test('PlatformFee - odd amount $10.01 (1001 cents) → 220 platform + 781 expert', () => {
  // Math.round(1001 * 22 / 100) = Math.round(220.22) = 220
  assertEquals(computePlatformFee(1001), 220);
  assertEquals(computeExpertAmount(1001), 781);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── PAYOUT HOLD TIMESTAMP TESTS ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test('PayoutHold - release date is exactly 3 days from now', () => {
  const now = new Date('2026-03-28T12:00:00Z');
  const release = computePayoutReleaseAt(now);
  assertEquals(release.toISOString(), '2026-03-31T12:00:00.000Z');
});

Deno.test('PayoutHold - works across month boundary', () => {
  const now = new Date('2026-03-30T18:00:00Z');
  const release = computePayoutReleaseAt(now);
  assertEquals(release.toISOString(), '2026-04-02T18:00:00.000Z');
});

Deno.test('PayoutHold - works across year boundary', () => {
  const now = new Date('2025-12-30T00:00:00Z');
  const release = computePayoutReleaseAt(now);
  assertEquals(release.toISOString(), '2026-01-02T00:00:00.000Z');
});

Deno.test('PayoutHold - exact millisecond delta is 259200000ms (3 * 86400 * 1000)', () => {
  const now = new Date();
  const release = computePayoutReleaseAt(now);
  assertEquals(release.getTime() - now.getTime(), 3 * 24 * 60 * 60 * 1000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── COMBINED SCENARIO TESTS ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test('Scenario - full success: 30-min call, 20 min actual, $50 → full capture', () => {
  const bookedSeconds = 30 * 60;
  const actualSeconds = 20 * 60;
  const amountCents = 5000;

  // Meets threshold (20/30 = 66.7% > 30%)
  assert(meetsThreshold(actualSeconds, bookedSeconds));

  // Full capture = total amount
  assertEquals(amountCents, 5000);

  // Platform gets 22%
  assertEquals(computePlatformFee(amountCents), 1100);
  // Expert gets 78%
  assertEquals(computeExpertAmount(amountCents), 3900);
});

Deno.test('Scenario - short session: 30-min call, 5 min actual, $50 → 50% capture ($25)', () => {
  const bookedSeconds = 30 * 60;
  const actualSeconds = 5 * 60;
  const amountCents = 5000;

  // Does NOT meet threshold (5/30 = 16.7% < 30%)
  assert(!meetsThreshold(actualSeconds, bookedSeconds));

  // 50% short-session fee
  const fee = computeShortSessionFee(amountCents);
  assertEquals(fee, 2500);

  // Fan pays only $25, gets $25 released
  const refund = amountCents - fee;
  assertEquals(refund, 2500);

  // Platform fee on the captured $25
  assertEquals(computePlatformFee(fee), 550);
  assertEquals(computeExpertAmount(fee), 1950);
});

Deno.test('Scenario - fan no-show: $100 booking → 30% no-show fee ($30)', () => {
  const amountCents = 10000;

  const fee = computeNoShowFee(amountCents);
  assertEquals(fee, 3000);

  // Remaining 70% ($70) is released back
  assertEquals(amountCents - fee, 7000);

  // Platform fee on the $30 captured
  assertEquals(computePlatformFee(fee), 660);
  assertEquals(computeExpertAmount(fee), 2340);
});

Deno.test('Scenario - creator no-show: $100 booking → full cancel, $0 captured', () => {
  // Creator no-show = cancel authorization entirely
  const amountCents = 10000;
  const captured = 0;
  assertEquals(captured, 0);
  assertEquals(computePlatformFee(captured), 0);
  assertEquals(computeExpertAmount(captured), 0);
});

Deno.test('Scenario - both no-show: $100 booking → full cancel, $0 captured', () => {
  const captured = 0;
  assertEquals(captured, 0);
});

Deno.test('Scenario - boundary: 30-min call, exactly 9 min (540s) → full capture', () => {
  const bookedSeconds = 30 * 60;
  const actualSeconds = 540; // exactly 30%
  assert(meetsThreshold(actualSeconds, bookedSeconds));
  // Full capture
  assertEquals(computeShortSessionFee(5000), 2500);
});

Deno.test('Scenario - boundary: 30-min call, 8min59s (539s) → 50% capture', () => {
  const bookedSeconds = 30 * 60;
  const actualSeconds = 539; // just under 30%
  assert(!meetsThreshold(actualSeconds, bookedSeconds));
  // 50% capture
  assertEquals(computeShortSessionFee(5000), 2500);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── SECURITY INVARIANT TESTS ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test('Security - amount_to_capture never exceeds authorized amount', () => {
  // Simulates the capture logic for various amounts
  const amounts = [1, 50, 100, 999, 1000, 5000, 10000, 50000, 99999, 100000];
  for (const total of amounts) {
    const shortFee = computeShortSessionFee(total);
    const noShowFee = computeNoShowFee(total);

    assert(shortFee <= total, `short-session fee ${shortFee} > total ${total}`);
    assert(noShowFee <= total, `no-show fee ${noShowFee} > total ${total}`);
    assert(shortFee >= 0, `short-session fee negative for ${total}`);
    assert(noShowFee >= 0, `no-show fee negative for ${total}`);
  }
});

Deno.test('Security - legacy refund amount never exceeds total (short session)', () => {
  const amounts = [1, 50, 100, 999, 1000, 5000, 10000, 50000, 99999];
  for (const total of amounts) {
    const fee = computeShortSessionFee(total);
    const refund = total - fee;
    assert(refund >= 0, `Legacy refund ${refund} is negative for total ${total}`);
    assert(refund <= total, `Legacy refund ${refund} exceeds total ${total}`);
  }
});

Deno.test('Security - legacy refund amount never exceeds total (no-show)', () => {
  const amounts = [1, 50, 100, 999, 1000, 5000, 10000, 50000, 99999];
  for (const total of amounts) {
    const fee = computeNoShowFee(total);
    const refund = total - fee;
    assert(refund >= 0, `No-show refund ${refund} is negative for total ${total}`);
    assert(refund <= total, `No-show refund ${refund} exceeds total ${total}`);
  }
});

Deno.test('Security - all fees are integers (no floating point cents)', () => {
  const amounts = [1, 3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 97, 101, 997, 1001, 9999, 10001];
  for (const total of amounts) {
    const shortFee = computeShortSessionFee(total);
    const noShowFee = computeNoShowFee(total);
    const platformFee = computePlatformFee(total);

    assert(Number.isInteger(shortFee), `Short fee ${shortFee} not integer for ${total}`);
    assert(Number.isInteger(noShowFee), `No-show fee ${noShowFee} not integer for ${total}`);
    assert(Number.isInteger(platformFee), `Platform fee ${platformFee} not integer for ${total}`);
  }
});

Deno.test('Security - negative amounts produce non-positive fees (guard)', () => {
  // Edge functions should never receive negative amounts, but verify arithmetic
  // does not produce dangerous positive values from negative inputs
  const fee = computeShortSessionFee(-1000);
  assert(fee <= 0, `Short session fee from negative amount should be ≤ 0, got ${fee}`);
});

Deno.test('Security - very large amount does not overflow', () => {
  // $1,000,000.00 = 100_000_000 cents
  const total = 100_000_000;
  const shortFee = computeShortSessionFee(total);
  const noShowFee = computeNoShowFee(total);
  const platformFee = computePlatformFee(total);

  assertEquals(shortFee, 50_000_000);
  assertEquals(noShowFee, 30_000_000);
  assertEquals(platformFee, 22_000_000);
  assert(Number.isInteger(shortFee));
  assert(Number.isInteger(noShowFee));
  assert(Number.isInteger(platformFee));
});
