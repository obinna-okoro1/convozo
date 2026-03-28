-- ============================================================================
-- Migration 042: Call Escrow — Manual Capture + 3-Day Payout Hold
--
-- Implements the production-grade escrow architecture for call bookings:
--   1. Adds 'pending_release' payout_status for the 3-day hold period
--   2. Adds payout_release_at column (when the hold expires and payout can be released)
--   3. Adds capture_method column to track whether payment uses manual or automatic capture
--
-- Background:
--   Previously, Stripe destination charges were auto-captured at checkout,
--   transferring funds to the connected account immediately. This caused negative
--   platform balances when refunds were issued (transfer not reversed).
--
--   New architecture:
--   - capture_method: 'manual' → funds authorized only, captured after call validation
--   - 3-day payout hold after capture for dispute/review window
--   - Platform NEVER refunds from its own funds — only cancels authorizations
--     or refunds with reverse_transfer for legacy payments
-- ============================================================================

-- ── 1. Expand payout_status to include 'pending_release' ─────────────────────
-- Drop the existing CHECK constraint and recreate with the new value.
-- 'pending_release' means: payment captured, but held for 3-day review before expert payout.
ALTER TABLE public.call_bookings
  DROP CONSTRAINT IF EXISTS call_bookings_payout_status_check;

ALTER TABLE public.call_bookings
  ADD CONSTRAINT call_bookings_payout_status_check
    CHECK (payout_status IN ('held', 'pending_release', 'released', 'refunded'));

-- ── 2. Add payout_release_at — when the 3-day hold expires ──────────────────
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS payout_release_at TIMESTAMPTZ;

-- ── 3. Add capture_method tracking column ────────────────────────────────────
-- 'automatic' for legacy bookings (pre-migration), 'manual' for new bookings.
-- Defaults to 'automatic' so existing rows are correctly categorised.
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS capture_method TEXT NOT NULL DEFAULT 'automatic'
    CHECK (capture_method IN ('automatic', 'manual'));

-- ── 4. Index for the payout release cron job ─────────────────────────────────
-- Efficiently find bookings ready for payout release:
-- payout_status = 'pending_release' AND payout_release_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_call_bookings_pending_payout_release
  ON public.call_bookings (payout_release_at)
  WHERE payout_status = 'pending_release';
