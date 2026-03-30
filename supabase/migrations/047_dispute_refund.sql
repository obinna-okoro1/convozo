-- ============================================================================
-- Migration 047: Chargeback Dispute Freeze + Refund Tracking
--
-- Implements two missing capabilities:
--
--   1. Dispute freeze — when Stripe fires charge.dispute.created, the
--      stripe-webhook handler automatically sets payout_status = 'disputed',
--      preventing the release-payout cron from sending funds to the expert
--      while the chargeback is under review.
--
--   2. Refund tracking — records the Stripe refund ID and timestamp on both
--      call_bookings and payments so the audit trail is complete after an
--      expert-initiated refund via the new create-refund Edge Function.
--
-- Schema changes:
--   call_bookings:
--     - payout_status constraint: adds 'disputed'
--     - dispute_id TEXT              — Stripe dispute ID (e.g. dp_xxx)
--     - dispute_frozen_at TIMESTAMPTZ — when the payout freeze was applied
--     - refund_id TEXT               — Stripe refund ID (re_xxx, from create-refund)
--   payments (message payments):
--     - status constraint: adds 'disputed'
--     - dispute_id TEXT
--     - dispute_frozen_at TIMESTAMPTZ
--     - refund_id TEXT
--     - refunded_at TIMESTAMPTZ
--   messages:
--     - refunded_at TIMESTAMPTZ — set by create-refund so the inbox can show
--       the refund status without joining to the payments table
-- ============================================================================

-- ── 1. Expand call_bookings.payout_status to include 'disputed' ───────────────
-- 'disputed' means: a Stripe chargeback is open — payout is frozen until resolved.
ALTER TABLE public.call_bookings
  DROP CONSTRAINT IF EXISTS call_bookings_payout_status_check;

ALTER TABLE public.call_bookings
  ADD CONSTRAINT call_bookings_payout_status_check
    CHECK (payout_status IN ('held', 'pending_release', 'released', 'refunded', 'disputed'));

-- ── 2. Add dispute + refund columns to call_bookings ─────────────────────────
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS dispute_id TEXT;

ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS dispute_frozen_at TIMESTAMPTZ;

ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS refund_id TEXT;

-- ── 3. Expand payments.status to include 'disputed' ──────────────────────────
-- Find and drop the existing status check constraint (name varies per env).
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name   = 'payments'
    AND constraint_type = 'CHECK'
    AND constraint_name ILIKE '%status%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.payments DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;
END $$;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed'));

-- ── 4. Add dispute + refund columns to payments ───────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS dispute_id TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS dispute_frozen_at TIMESTAMPTZ;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refund_id TEXT;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- ── 5. Add refunded_at to messages ───────────────────────────────────────────
-- Denormalised shortcut so the inbox can show refund status without a payments join.
-- Set by the create-refund Edge Function simultaneously with payments.refunded_at.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- ── 6. Indexes for fast dispute lookup by payment_intent_id ──────────────────
-- The dispute handler needs to find call_bookings and payments by PI ID quickly.
-- These are also useful for the refund endpoint doing the same lookup.
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi_id
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_bookings_stripe_pi_id
  ON public.call_bookings (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Partial index: quickly find disputed rows (for release-payout to skip)
CREATE INDEX IF NOT EXISTS idx_call_bookings_disputed
  ON public.call_bookings (dispute_id)
  WHERE payout_status = 'disputed';

-- ── 7. Column comments for audit clarity ─────────────────────────────────────
COMMENT ON COLUMN public.call_bookings.dispute_id IS
  'Stripe dispute ID (dp_xxx). Set by the stripe-webhook charge.dispute.created handler. '
  'Presence means the payout is frozen. Cleared behaviour: status restored on dispute.won.';

COMMENT ON COLUMN public.call_bookings.dispute_frozen_at IS
  'Timestamp when the payout freeze was applied by the dispute handler. '
  'Set to NULL when dispute is resolved in our favour (payout restored).';

COMMENT ON COLUMN public.call_bookings.refund_id IS
  'Stripe refund ID (re_xxx). Set by the create-refund Edge Function when an expert '
  'issues a refund. Never set by the dispute handler (disputes use dispute_id).';

COMMENT ON COLUMN public.payments.dispute_id IS
  'Stripe dispute ID (dp_xxx) for message payments. Mirrors call_bookings.dispute_id logic.';

COMMENT ON COLUMN public.payments.refund_id IS
  'Stripe refund ID (re_xxx). Set when an expert issues a refund for a message payment.';

COMMENT ON COLUMN public.messages.refunded_at IS
  'Timestamp when the payment for this message was refunded via create-refund. '
  'Denormalised from payments.refunded_at for fast inbox display.';
