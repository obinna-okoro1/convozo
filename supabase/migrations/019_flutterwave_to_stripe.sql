-- ============================================================
-- Migration 019: Replace Flutterwave with Stripe
-- ============================================================
-- This migration:
--   1. Creates `stripe_accounts` table (replaces `flutterwave_subaccounts`)
--   2. Renames FLW columns on `payments`, `messages`, `call_bookings`
--      back to Stripe column names
--   3. Drops `flutterwave_subaccounts` table and related objects
--   4. Drops `account_change_requests` table (FLW-specific, no longer needed)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Create stripe_accounts table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE NOT NULL,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(creator_id)
);

-- Updated-at trigger
CREATE TRIGGER update_stripe_accounts_updated_at
  BEFORE UPDATE ON public.stripe_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Creators can view own stripe account"
  ON public.stripe_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = stripe_accounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can update own stripe account"
  ON public.stripe_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = stripe_accounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can insert own stripe account"
  ON public.stripe_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = stripe_accounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on stripe_accounts"
  ON public.stripe_accounts FOR ALL
  USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 2. Rename FLW columns → Stripe columns
-- ────────────────────────────────────────────────────────────

-- payments table
ALTER TABLE public.payments
  RENAME COLUMN flw_tx_ref TO stripe_session_id;

ALTER TABLE public.payments
  RENAME COLUMN flw_transaction_id TO stripe_payment_intent_id;

DROP INDEX IF EXISTS idx_payments_flw_tx_ref;
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session_id ON public.payments(stripe_session_id);

-- messages table
ALTER TABLE public.messages
  RENAME COLUMN flw_tx_ref TO stripe_session_id;

-- call_bookings table
ALTER TABLE public.call_bookings
  RENAME COLUMN flw_tx_ref TO stripe_session_id;

ALTER TABLE public.call_bookings
  RENAME COLUMN flw_transaction_id TO stripe_payment_intent_id;

-- ────────────────────────────────────────────────────────────
-- 3. Drop flutterwave_subaccounts table
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Creators can view own flutterwave subaccount" ON public.flutterwave_subaccounts;
DROP POLICY IF EXISTS "Creators can update own flutterwave subaccount" ON public.flutterwave_subaccounts;
DROP POLICY IF EXISTS "Creators can insert own flutterwave subaccount" ON public.flutterwave_subaccounts;
DROP POLICY IF EXISTS "Service role full access on flutterwave_subaccounts" ON public.flutterwave_subaccounts;
DROP TRIGGER IF EXISTS update_flutterwave_subaccounts_updated_at ON public.flutterwave_subaccounts;
DROP TABLE IF EXISTS public.flutterwave_subaccounts;

-- ────────────────────────────────────────────────────────────
-- 4. Drop account_change_requests (FLW bank-specific, not needed for Stripe)
-- ────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.account_change_requests CASCADE;
