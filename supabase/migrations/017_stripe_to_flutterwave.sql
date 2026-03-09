-- ============================================================
-- Migration 012: Replace Stripe with Flutterwave
-- ============================================================
-- This migration:
--   1. Creates `flutterwave_subaccounts` table (replaces `stripe_accounts`)
--   2. Renames Stripe columns on `payments`, `messages`, `call_bookings`
--   3. Drops old `stripe_accounts` table and its policies/trigger
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Create flutterwave_subaccounts table
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flutterwave_subaccounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  subaccount_id TEXT UNIQUE NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  country TEXT NOT NULL DEFAULT 'NG',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(creator_id)
);

-- Updated-at trigger
CREATE TRIGGER update_flutterwave_subaccounts_updated_at
  BEFORE UPDATE ON public.flutterwave_subaccounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.flutterwave_subaccounts ENABLE ROW LEVEL SECURITY;

-- RLS policies (mirror the old stripe_accounts policies)
CREATE POLICY "Creators can view own flutterwave subaccount"
  ON public.flutterwave_subaccounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = flutterwave_subaccounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can update own flutterwave subaccount"
  ON public.flutterwave_subaccounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = flutterwave_subaccounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can insert own flutterwave subaccount"
  ON public.flutterwave_subaccounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = flutterwave_subaccounts.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Service role needs full access for edge functions
CREATE POLICY "Service role full access on flutterwave_subaccounts"
  ON public.flutterwave_subaccounts FOR ALL
  USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 2. Rename Stripe columns → Flutterwave columns
-- ────────────────────────────────────────────────────────────

-- payments table
ALTER TABLE public.payments
  RENAME COLUMN stripe_checkout_session_id TO flw_tx_ref;

ALTER TABLE public.payments
  RENAME COLUMN stripe_payment_intent_id TO flw_transaction_id;

-- Drop the old index and recreate with new name
DROP INDEX IF EXISTS idx_payments_session_id;
CREATE INDEX idx_payments_flw_tx_ref ON public.payments(flw_tx_ref);

-- messages table
ALTER TABLE public.messages
  RENAME COLUMN stripe_checkout_session_id TO flw_tx_ref;

-- call_bookings table
ALTER TABLE public.call_bookings
  RENAME COLUMN stripe_checkout_session_id TO flw_tx_ref;

ALTER TABLE public.call_bookings
  RENAME COLUMN stripe_payment_intent_id TO flw_transaction_id;

-- ────────────────────────────────────────────────────────────
-- 3. Drop old stripe_accounts table
-- ────────────────────────────────────────────────────────────

-- Drop RLS policies first
DROP POLICY IF EXISTS "Creators can view own stripe account" ON public.stripe_accounts;
DROP POLICY IF EXISTS "Creators can update own stripe account" ON public.stripe_accounts;
DROP POLICY IF EXISTS "Creators can insert own stripe account" ON public.stripe_accounts;

-- Drop trigger
DROP TRIGGER IF EXISTS update_stripe_accounts_updated_at ON public.stripe_accounts;

-- Drop the table
DROP TABLE IF EXISTS public.stripe_accounts;
