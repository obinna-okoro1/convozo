-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 045: Payout hold period update (3 days → 7 days)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Purpose:
--   Updates the payout hold period from 3 calendar days to 7 calendar days.
--   This provides a stronger chargeback safety net — most card disputes are
--   filed within the first 7 days of a transaction.
--
--   No schema changes are needed. The hold period is a runtime constant
--   in the edge functions (PAYOUT_HOLD_DAYS in _shared/constants.ts).
--   This migration documents the policy change for the audit trail and
--   backfills any existing 'pending_release' rows that were set with
--   the old 3-day window (extending them to 7 days from their capture time).
--
-- Related:
--   - Migration 042: Added payout_status, payout_release_at, payout_released_at
--   - supabase/functions/_shared/constants.ts: PAYOUT_HOLD_DAYS = 7
--   - supabase/functions/release-payout/index.ts: new release cron function
--   - supabase/functions/complete-call/index.ts: uses shared constant
--   - supabase/functions/check-no-show/index.ts: uses shared constant
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Extend existing pending_release rows to 7-day hold ────────────────────
-- Any bookings already in 'pending_release' state were set with a 3-day window.
-- Extend their payout_release_at to be 7 days from call_ended_at, capped to
-- at least 2 days from now (to give a reasonable remaining hold for recent ones).
--
-- This is additive — it only moves release dates forward, never backward.
-- Experts are protected; no payout is released earlier than the new policy.

UPDATE public.call_bookings
SET payout_release_at = GREATEST(
  -- 7 days from when the call ended (the canonical hold start)
  COALESCE(call_ended_at, updated_at) + INTERVAL '7 days',
  -- Floor: never set a release date in the past
  NOW() + INTERVAL '2 days'
)
WHERE payout_status = 'pending_release'
  AND payout_release_at IS NOT NULL;

-- ── 2. Add a comment to the column documenting current policy ────────────────
COMMENT ON COLUMN public.call_bookings.payout_release_at IS
  'Timestamp when the 7-day chargeback hold expires and payout can be released to the expert. '
  'Set by complete-call or check-no-show at capture time. '
  'Processed hourly by the release-payout edge function cron.';

-- ── 3. No index changes needed ───────────────────────────────────────────────
-- Migration 042 already created the covering index:
--   CREATE INDEX idx_call_bookings_payout_release
--   ON call_bookings (payout_status, payout_release_at)
--   WHERE payout_status = 'pending_release';
-- That index remains optimal for the release-payout cron query.
