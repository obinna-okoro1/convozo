/**
 * Shared financial and policy constants.
 *
 * Single source of truth for values used across multiple edge functions.
 * Any change here automatically propagates to complete-call, check-no-show,
 * release-payout, and any future function that imports from this file.
 *
 * IMPORTANT: These values must stay in sync with:
 *   - src/app/core/models/payment-flows.spec.ts (PAYOUT_HOLD_DAYS)
 *   - supabase/functions/tests/test_payment_flows.py (PAYOUT_HOLD_DAYS)
 *   - All user-facing copy mentioning hold periods
 */

/** Platform fee percentage retained by Convozo (integer, not decimal). */
export const PLATFORM_FEE_PERCENTAGE = 22;

/** Expert payout percentage (100 - PLATFORM_FEE_PERCENTAGE). */
export const EXPERT_PAYOUT_PERCENTAGE = 78;

/**
 * Number of calendar days to hold a captured payment before releasing to the expert.
 *
 * Rationale: 7 days covers the majority of card dispute window activity.
 * Most chargebacks are filed within the first 7 days. This provides a safety net
 * without being excessively long for the expert.
 */
export const PAYOUT_HOLD_DAYS = 7;

/** Minimum call completion threshold: session must reach this fraction of booked duration. */
export const COMPLETION_THRESHOLD = 0.30;

/** Charge percentage when session is below the completion threshold (< 30% of booked time). */
export const SHORT_CALL_CHARGE_PERCENT = 50;

/** Fan no-show fee: charge this percentage of booking amount as cancellation penalty. */
export const FAN_NO_SHOW_FEE_PERCENT = 30;

/** Grace period (minutes) before marking a booking as a no-show. */
export const GRACE_PERIOD_MINUTES = 10;
