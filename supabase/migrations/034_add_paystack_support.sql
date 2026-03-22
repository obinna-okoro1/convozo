-- ============================================================================
-- Migration 034: Add Paystack payment provider support
--
-- Adds:
--   1. `country` column on creators (ISO 3166-1 alpha-2, e.g. 'NG', 'ZA', 'US')
--      Derived from the phone country code selected during onboarding.
--   2. `payment_provider` column on creators — 'stripe' | 'paystack'.
--      Auto-derived from country: Nigeria (NG) and South Africa (ZA) → paystack,
--      everyone else → stripe. Can be overridden by an admin if needed.
--   3. `paystack_subaccounts` table — stores the Paystack subaccount_code for
--      creators who onboard via Paystack (NG/ZA).
--
-- All existing creators default to stripe / US to preserve backward compatibility.
-- ============================================================================

-- ── 1. Add country and payment_provider to creators ──────────────────────────

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US';

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'stripe'
  CHECK (payment_provider IN ('stripe', 'paystack'));

COMMENT ON COLUMN public.creators.country IS
  'ISO 3166-1 alpha-2 country code selected during onboarding, e.g. NG, ZA, US.';

COMMENT ON COLUMN public.creators.payment_provider IS
  'Payment gateway used for this creator: stripe (default) or paystack (NG/ZA).';

-- ── 2. paystack_subaccounts table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.paystack_subaccounts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id         UUID        NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  subaccount_code    TEXT        UNIQUE NOT NULL,  -- Paystack's ACCT_xxx identifier
  business_name      TEXT        NOT NULL,
  bank_name          TEXT        NOT NULL,
  bank_code          TEXT        NOT NULL,         -- Paystack bank code e.g. '044'
  account_number     TEXT        NOT NULL,
  country            TEXT        NOT NULL DEFAULT 'NG',  -- NG | ZA
  is_verified        BOOLEAN     NOT NULL DEFAULT false,
  is_active          BOOLEAN     NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_id)
);

CREATE TRIGGER update_paystack_subaccounts_updated_at
  BEFORE UPDATE ON public.paystack_subaccounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.paystack_subaccounts IS
  'Paystack subaccount registration for NG/ZA creators. '
  'The subaccount_code is used to split payments 78/22 at transaction time.';

-- ── 3. RLS on paystack_subaccounts ───────────────────────────────────────────

ALTER TABLE public.paystack_subaccounts ENABLE ROW LEVEL SECURITY;

-- Creator can read their own subaccount status
CREATE POLICY "Creator can read own paystack subaccount"
  ON public.paystack_subaccounts FOR SELECT
  TO authenticated
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Only service_role (Edge Functions) may insert/update — never the client directly
-- (No INSERT/UPDATE policies for authenticated — server-side only)

-- ── 4. Index ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_paystack_subaccounts_creator_id
  ON public.paystack_subaccounts(creator_id);

CREATE INDEX IF NOT EXISTS idx_creators_payment_provider
  ON public.creators(payment_provider);

-- ── 5. paystack_reference columns for idempotency ────────────────────────────
-- Used by the paystack-webhook Edge Function to detect duplicate charge.success
-- events and avoid creating duplicate messages / call bookings.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS paystack_reference TEXT UNIQUE;

ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS paystack_reference TEXT UNIQUE;

COMMENT ON COLUMN public.messages.paystack_reference IS
  'Paystack transaction reference used for idempotency in the paystack-webhook function.';

COMMENT ON COLUMN public.call_bookings.paystack_reference IS
  'Paystack transaction reference used for idempotency in the paystack-webhook function.';

-- ── 6. account_name on paystack_subaccounts ──────────────────────────────────
-- Stores the verified account holder name returned by Paystack account resolution.

ALTER TABLE public.paystack_subaccounts
  ADD COLUMN IF NOT EXISTS account_name TEXT;

COMMENT ON COLUMN public.paystack_subaccounts.account_name IS
  'Account holder name as returned by Paystack account number resolution.';
