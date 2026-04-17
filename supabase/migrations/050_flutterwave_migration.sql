-- ============================================================
-- Migration 050: Replace Paystack with Flutterwave
-- ============================================================
-- This migration:
--   1. Renames `paystack_subaccounts` → `flutterwave_subaccounts`
--   2. Renames `subaccount_code` → `subaccount_id` (Flutterwave format)
--   3. Drops `is_verified` column (Flutterwave subaccounts are immediately active)
--   4. Renames `paystack_reference` → `flutterwave_tx_ref` on messages & call_bookings
--   5. Adds `flutterwave_tx_ref` column to payments; makes `stripe_session_id` nullable
--      so that Flutterwave payment records don't require a Stripe session ID
--   6. Updates `payment_provider` CHECK constraint and migrates existing rows
--   7. Cleans up old indexes and rebuilds with Flutterwave-appropriate names
-- ============================================================

-- ── 1. Rename table & trigger ─────────────────────────────────────────────────

ALTER TABLE public.paystack_subaccounts
  RENAME TO flutterwave_subaccounts;

-- The trigger references the table name in its definition; drop and recreate.
DROP TRIGGER IF EXISTS update_paystack_subaccounts_updated_at ON public.flutterwave_subaccounts;

CREATE TRIGGER update_flutterwave_subaccounts_updated_at
  BEFORE UPDATE ON public.flutterwave_subaccounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.flutterwave_subaccounts IS
  'Stores the Flutterwave subaccount ID for NG/ZA creators. One row per creator.';

-- ── 2. Rename subaccount_code → subaccount_id ────────────────────────────────

ALTER TABLE public.flutterwave_subaccounts
  RENAME COLUMN subaccount_code TO subaccount_id;

COMMENT ON COLUMN public.flutterwave_subaccounts.subaccount_id IS
  'Flutterwave subaccount ID (e.g. RS_xxxxxx) used for split payments at checkout.';

-- ── 3. Drop is_verified ───────────────────────────────────────────────────────
-- Flutterwave subaccounts are immediately active upon creation — there is no
-- asynchronous verification step like Paystack has.

ALTER TABLE public.flutterwave_subaccounts
  DROP COLUMN IF EXISTS is_verified;

-- ── 4. Rename reference columns on messages & call_bookings ─────────────────

ALTER TABLE public.messages
  RENAME COLUMN paystack_reference TO flutterwave_tx_ref;

COMMENT ON COLUMN public.messages.flutterwave_tx_ref IS
  'Flutterwave tx_ref used for idempotency in the flutterwave-webhook function.';

ALTER TABLE public.call_bookings
  RENAME COLUMN paystack_reference TO flutterwave_tx_ref;

COMMENT ON COLUMN public.call_bookings.flutterwave_tx_ref IS
  'Flutterwave tx_ref used for idempotency in the flutterwave-webhook function.';

-- ── 5. Add flutterwave_tx_ref to payments; make stripe_session_id nullable ───
-- payments.stripe_session_id was originally NOT NULL (Stripe-only era). Now that
-- Flutterwave payments also land in this table, Stripe rows have stripe_session_id
-- and Flutterwave rows have flutterwave_tx_ref — each nullable on the other side.

ALTER TABLE public.payments
  ALTER COLUMN stripe_session_id DROP NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS flutterwave_tx_ref TEXT UNIQUE;

COMMENT ON COLUMN public.payments.flutterwave_tx_ref IS
  'Flutterwave tx_ref for NG/ZA payments. Mutually exclusive with stripe_session_id.';

-- ── 6. Update payment_provider CHECK constraint & existing rows ───────────────

-- Drop the old constraint before recreating (constraint name from migration 034)
ALTER TABLE public.creators
  DROP CONSTRAINT IF EXISTS creators_payment_provider_check;

ALTER TABLE public.creators
  ADD CONSTRAINT creators_payment_provider_check
  CHECK (payment_provider IN ('stripe', 'flutterwave'));

-- Migrate any existing NG/ZA creators from paystack → flutterwave
UPDATE public.creators
  SET payment_provider = 'flutterwave'
  WHERE payment_provider = 'paystack';

-- ── 7. Rebuild indexes ────────────────────────────────────────────────────────

DROP INDEX IF EXISTS idx_paystack_subaccounts_creator_id;

CREATE INDEX IF NOT EXISTS idx_flutterwave_subaccounts_creator_id
  ON public.flutterwave_subaccounts(creator_id);

CREATE INDEX IF NOT EXISTS idx_payments_flutterwave_tx_ref
  ON public.payments(flutterwave_tx_ref);

-- ── 8. Update RLS policy names on flutterwave_subaccounts ────────────────────
-- Policies travel with the renamed table but keep their old names. Rename them
-- for consistency so future engineers aren't confused by "paystack" names on the
-- Flutterwave table.

ALTER POLICY "Creators can view own paystack subaccount"
  ON public.flutterwave_subaccounts
  RENAME TO "Creators can view own flutterwave subaccount";

ALTER POLICY "Service role full access on paystack_subaccounts"
  ON public.flutterwave_subaccounts
  RENAME TO "Service role full access on flutterwave_subaccounts";
