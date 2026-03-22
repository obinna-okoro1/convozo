-- ============================================================================
-- Migration 031: Analytics Retention
--
-- Introduces creator_monthly_analytics — a pre-aggregated monthly stats table
-- that is completely decoupled from the raw transaction records (messages,
-- call_bookings, shop_orders, payments).
--
-- Key guarantees:
--   1. Deleting a message / call booking / shop order NEVER alters analytics.
--   2. Analytics rows are only removed when the creator's account is deleted
--      (via the ON DELETE CASCADE to creators).
--   3. Refunds are tracked separately from gross revenue so the dashboard can
--      show both "total earned" and "refunds issued" side-by-side.
--   4. Monthly granularity: one row per (creator, calendar-month).
--   5. Back-fill: existing data is aggregated on migration run.
--
-- Revenue attribution:
--   • Messages / tips / follow-backs → payments table
--       (recognised on status = 'completed'; reversed on status = 'refunded')
--   • Calls                          → call_bookings table
--       (recognised on payout_status = 'released'; reversed on 'refunded')
--   • Shop orders                    → shop_orders table
--       (recognised on status = 'completed'; reversed on status = 'refunded')
--
-- Platform fee: 22% of gross, creator keeps 78%.
--   platform_fee = ROUND(amount::NUMERIC * 22 / 100)::INTEGER  (integer cents)
--   creator_net  = amount - platform_fee
--
-- All monetary values are INTEGER CENTS. No floating point.
-- ============================================================================


-- ── 1. Monthly analytics table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.creator_monthly_analytics (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID  NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,

  -- First day of the calendar month (UTC), e.g. '2026-03-01'
  month      DATE  NOT NULL,

  -- ── Messages (paid DMs, tips, follow-back requests) ──────────────────────
  -- Source: payments table (message_id IS NOT NULL or message_type IN payments)
  message_count         INTEGER NOT NULL DEFAULT 0,  -- completed payments
  message_gross         INTEGER NOT NULL DEFAULT 0,  -- total charged, cents
  message_platform_fee  INTEGER NOT NULL DEFAULT 0,  -- platform 22%, cents
  message_net           INTEGER NOT NULL DEFAULT 0,  -- creator 78%, cents
  message_refund_count  INTEGER NOT NULL DEFAULT 0,  -- payments flipped to 'refunded'
  message_refund_amount INTEGER NOT NULL DEFAULT 0,  -- cents returned to fan

  -- ── Calls ──────────────────────────────────────────────────────────────────
  -- Source: call_bookings table
  -- Revenue recognised when payout_status → 'released' (creator paid out)
  call_count         INTEGER NOT NULL DEFAULT 0,
  call_gross         INTEGER NOT NULL DEFAULT 0,  -- cents
  call_platform_fee  INTEGER NOT NULL DEFAULT 0,  -- cents
  call_net           INTEGER NOT NULL DEFAULT 0,  -- cents
  call_refund_count  INTEGER NOT NULL DEFAULT 0,
  call_refund_amount INTEGER NOT NULL DEFAULT 0,  -- cents returned to fan

  -- ── Shop orders ────────────────────────────────────────────────────────────
  -- Source: shop_orders table
  shop_order_count      INTEGER NOT NULL DEFAULT 0,
  shop_gross            INTEGER NOT NULL DEFAULT 0,  -- cents
  shop_platform_fee     INTEGER NOT NULL DEFAULT 0,  -- cents
  shop_net              INTEGER NOT NULL DEFAULT 0,  -- cents
  shop_refund_count     INTEGER NOT NULL DEFAULT 0,
  shop_refund_amount    INTEGER NOT NULL DEFAULT 0,  -- cents returned to buyer

  -- ── Cross-stream totals (denormalised for fast dashboard queries) ──────────
  total_gross        INTEGER NOT NULL DEFAULT 0,  -- message + call + shop gross
  total_platform_fee INTEGER NOT NULL DEFAULT 0,
  total_net          INTEGER NOT NULL DEFAULT 0,  -- what creator actually earned
  total_refunds      INTEGER NOT NULL DEFAULT 0,  -- total refund amount (all streams)

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One row per creator per month
  UNIQUE(creator_id, month)
);

-- Index for fast dashboard queries: "show me this creator's last 12 months"
CREATE INDEX IF NOT EXISTS idx_analytics_creator_month
  ON public.creator_monthly_analytics (creator_id, month DESC);

-- Reuse the existing updated_at trigger function from migration 001
CREATE TRIGGER update_creator_monthly_analytics_updated_at
  BEFORE UPDATE ON public.creator_monthly_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 2. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.creator_monthly_analytics ENABLE ROW LEVEL SECURITY;

-- Creators can read their own monthly analytics
CREATE POLICY analytics_creator_select
  ON public.creator_monthly_analytics FOR SELECT
  USING (
    creator_id IN (
      SELECT id FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policies for regular users.
-- Writes come exclusively from SECURITY DEFINER trigger functions (below),
-- which run with postgres-owner privileges and bypass RLS.
-- Analytics rows are removed only via ON DELETE CASCADE when the account is deleted.


-- ── 3. Helper: ensure a monthly row exists before incrementing ────────────────

CREATE OR REPLACE FUNCTION public.analytics_ensure_row(
  p_creator_id UUID,
  p_month      DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.creator_monthly_analytics (creator_id, month)
  VALUES (p_creator_id, p_month)
  ON CONFLICT (creator_id, month) DO NOTHING;
END;
$$;


-- ── 4. Trigger function: payments table ──────────────────────────────────────
--
-- Fires AFTER INSERT OR UPDATE OF status.
--
-- INSERT with status = 'completed':
--   → Increment message counts + gross + fee + net + totals
--
-- UPDATE: old status != 'completed', new status = 'completed' (late webhook):
--   → Same as INSERT completed
--
-- UPDATE: old status != 'refunded', new status = 'refunded':
--   → Increment refund count + amount; subtract net from totals
--   → Gross is intentionally kept (shows real transaction volume)
--
-- The platform_fee and creator_amount columns already exist on payments,
-- so we use those exact values — no recomputation needed.

CREATE OR REPLACE FUNCTION public.trg_analytics_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Attribute revenue to the month the payment was originally created
  v_month DATE := DATE_TRUNC('month', NEW.created_at)::DATE;
BEGIN
  PERFORM public.analytics_ensure_row(NEW.creator_id, v_month);

  -- ── New completed payment ──
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed')
  OR (TG_OP = 'UPDATE' AND OLD.status <> 'completed' AND NEW.status = 'completed')
  THEN
    UPDATE public.creator_monthly_analytics
    SET
      message_count        = message_count        + 1,
      message_gross        = message_gross        + NEW.amount,
      message_platform_fee = message_platform_fee + NEW.platform_fee,
      message_net          = message_net          + NEW.creator_amount,
      total_gross          = total_gross          + NEW.amount,
      total_platform_fee   = total_platform_fee   + NEW.platform_fee,
      total_net            = total_net            + NEW.creator_amount
    WHERE creator_id = NEW.creator_id AND month = v_month;

  -- ── Payment refunded ──
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status <> 'refunded'
    AND NEW.status  = 'refunded'
  THEN
    -- Record the refund. Gross stays intact; only net is reversed so the
    -- dashboard can clearly show "earned $X, refunded $Y, net $Z".
    UPDATE public.creator_monthly_analytics
    SET
      message_refund_count  = message_refund_count  + 1,
      message_refund_amount = message_refund_amount + NEW.amount,
      -- Only reverse the net if this payment was previously 'completed'
      message_net           = CASE WHEN OLD.status = 'completed'
                                THEN message_net - OLD.creator_amount
                                ELSE message_net
                              END,
      total_refunds         = total_refunds         + NEW.amount,
      total_net             = CASE WHEN OLD.status = 'completed'
                                THEN total_net - OLD.creator_amount
                                ELSE total_net
                              END
    WHERE creator_id = NEW.creator_id AND month = v_month;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payments_analytics
  AFTER INSERT OR UPDATE OF status
  ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_analytics_on_payment();


-- ── 5. Trigger function: call_bookings table ─────────────────────────────────
--
-- Fires AFTER UPDATE OF payout_status.
--
-- payout_status: held → released (creator paid out):
--   → Increment call counts + gross + fee + net + totals
--
-- payout_status: * → refunded (fan refunded):
--   → Increment refund count + amount
--   → If payout was previously 'released', also reverse creator net
--
-- Platform fee is computed from amount_paid since call_bookings does not
-- store it explicitly:
--   platform_fee = ROUND(amount_paid::NUMERIC * 22 / 100)::INTEGER

CREATE OR REPLACE FUNCTION public.trg_analytics_on_call_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month        DATE    := DATE_TRUNC('month', NEW.created_at)::DATE;
  v_platform_fee INTEGER := ROUND(NEW.amount_paid::NUMERIC * 22 / 100)::INTEGER;
  v_net          INTEGER := NEW.amount_paid - v_platform_fee;
BEGIN
  PERFORM public.analytics_ensure_row(NEW.creator_id, v_month);

  -- ── Payout released to creator ──
  IF OLD.payout_status <> 'released' AND NEW.payout_status = 'released' THEN
    UPDATE public.creator_monthly_analytics
    SET
      call_count        = call_count        + 1,
      call_gross        = call_gross        + NEW.amount_paid,
      call_platform_fee = call_platform_fee + v_platform_fee,
      call_net          = call_net          + v_net,
      total_gross       = total_gross       + NEW.amount_paid,
      total_platform_fee = total_platform_fee + v_platform_fee,
      total_net         = total_net         + v_net
    WHERE creator_id = NEW.creator_id AND month = v_month;

  -- ── Fan refunded ──
  ELSIF OLD.payout_status <> 'refunded' AND NEW.payout_status = 'refunded' THEN
    UPDATE public.creator_monthly_analytics
    SET
      call_refund_count  = call_refund_count  + 1,
      call_refund_amount = call_refund_amount + NEW.amount_paid,
      total_refunds      = total_refunds      + NEW.amount_paid,
      -- If payout was already released, we also need to reverse creator net
      call_net           = CASE WHEN OLD.payout_status = 'released'
                             THEN call_net - v_net
                             ELSE call_net
                           END,
      total_net          = CASE WHEN OLD.payout_status = 'released'
                             THEN total_net - v_net
                             ELSE total_net
                           END
    WHERE creator_id = NEW.creator_id AND month = v_month;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_call_bookings_analytics
  AFTER UPDATE OF payout_status
  ON public.call_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_analytics_on_call_booking();


-- ── 6. Trigger function: shop_orders table ───────────────────────────────────
--
-- Fires AFTER INSERT OR UPDATE OF status.
--
-- INSERT with status = 'completed':
--   → Increment shop counts + gross + fee + net + totals
--
-- UPDATE: old status != 'completed', new status = 'completed' (late webhook):
--   → Same as INSERT completed
--
-- UPDATE: old status != 'refunded', new status = 'refunded':
--   → Increment refund count + amount; reverse net
--
-- Platform fee computed from amount_paid (shop_orders has no explicit fee col).

CREATE OR REPLACE FUNCTION public.trg_analytics_on_shop_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month        DATE    := DATE_TRUNC('month', NEW.created_at)::DATE;
  v_platform_fee INTEGER := ROUND(NEW.amount_paid::NUMERIC * 22 / 100)::INTEGER;
  v_net          INTEGER := NEW.amount_paid - v_platform_fee;
BEGIN
  PERFORM public.analytics_ensure_row(NEW.creator_id, v_month);

  -- ── New completed shop sale ──
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed')
  OR (TG_OP = 'UPDATE' AND OLD.status <> 'completed' AND NEW.status = 'completed')
  THEN
    UPDATE public.creator_monthly_analytics
    SET
      shop_order_count  = shop_order_count  + 1,
      shop_gross        = shop_gross        + NEW.amount_paid,
      shop_platform_fee = shop_platform_fee + v_platform_fee,
      shop_net          = shop_net          + v_net,
      total_gross       = total_gross       + NEW.amount_paid,
      total_platform_fee = total_platform_fee + v_platform_fee,
      total_net         = total_net         + v_net
    WHERE creator_id = NEW.creator_id AND month = v_month;

  -- ── Order refunded ──
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status <> 'refunded'
    AND NEW.status  = 'refunded'
  THEN
    UPDATE public.creator_monthly_analytics
    SET
      shop_refund_count  = shop_refund_count  + 1,
      shop_refund_amount = shop_refund_amount + NEW.amount_paid,
      -- Reverse net only if it was previously counted as completed
      shop_net           = CASE WHEN OLD.status = 'completed'
                             THEN shop_net - v_net
                             ELSE shop_net
                           END,
      total_refunds      = total_refunds      + NEW.amount_paid,
      total_net          = CASE WHEN OLD.status = 'completed'
                             THEN total_net - v_net
                             ELSE total_net
                           END
    WHERE creator_id = NEW.creator_id AND month = v_month;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shop_orders_analytics
  AFTER INSERT OR UPDATE OF status
  ON public.shop_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_analytics_on_shop_order();


-- ── 7. Back-fill existing data ────────────────────────────────────────────────
--
-- Populate analytics from all existing records so the table is immediately
-- useful without waiting for new transactions.
--
-- Step A: messages (from payments table)
-- Step B: calls (from call_bookings)
-- Step C: shop (from shop_orders)
-- Each step uses ON CONFLICT DO UPDATE to merge into existing rows.

-- ── Step A: Messages from payments ──
INSERT INTO public.creator_monthly_analytics (
  creator_id, month,
  message_count, message_gross, message_platform_fee, message_net,
  message_refund_count, message_refund_amount,
  total_gross, total_platform_fee, total_net, total_refunds
)
SELECT
  creator_id,
  DATE_TRUNC('month', created_at)::DATE                                          AS month,
  COUNT(*)         FILTER (WHERE status = 'completed')                           AS message_count,
  COALESCE(SUM(amount)          FILTER (WHERE status = 'completed'), 0)          AS message_gross,
  COALESCE(SUM(platform_fee)    FILTER (WHERE status = 'completed'), 0)          AS message_platform_fee,
  COALESCE(SUM(creator_amount)  FILTER (WHERE status = 'completed'), 0)          AS message_net,
  COUNT(*)         FILTER (WHERE status = 'refunded')                            AS message_refund_count,
  COALESCE(SUM(amount)          FILTER (WHERE status = 'refunded'),  0)          AS message_refund_amount,
  -- Totals seeded with message values; calls and shop added via DO UPDATE below
  COALESCE(SUM(amount)          FILTER (WHERE status = 'completed'), 0)          AS total_gross,
  COALESCE(SUM(platform_fee)    FILTER (WHERE status = 'completed'), 0)          AS total_platform_fee,
  COALESCE(SUM(creator_amount)  FILTER (WHERE status = 'completed'), 0)          AS total_net,
  COALESCE(SUM(amount)          FILTER (WHERE status = 'refunded'),  0)          AS total_refunds
FROM public.payments
GROUP BY creator_id, DATE_TRUNC('month', created_at)::DATE
ON CONFLICT (creator_id, month) DO UPDATE SET
  message_count        = EXCLUDED.message_count,
  message_gross        = EXCLUDED.message_gross,
  message_platform_fee = EXCLUDED.message_platform_fee,
  message_net          = EXCLUDED.message_net,
  message_refund_count = EXCLUDED.message_refund_count,
  message_refund_amount = EXCLUDED.message_refund_amount,
  total_gross          = EXCLUDED.total_gross,
  total_platform_fee   = EXCLUDED.total_platform_fee,
  total_net            = EXCLUDED.total_net,
  total_refunds        = EXCLUDED.total_refunds,
  updated_at           = NOW();

-- ── Step B: Calls from call_bookings ──
WITH call_stats AS (
  SELECT
    creator_id,
    DATE_TRUNC('month', created_at)::DATE                                        AS month,
    COUNT(*)    FILTER (WHERE payout_status = 'released')                        AS call_count,
    COALESCE(SUM(amount_paid) FILTER (WHERE payout_status = 'released'), 0)      AS call_gross,
    COALESCE(SUM(ROUND(amount_paid::NUMERIC * 22 / 100)::INTEGER)
             FILTER (WHERE payout_status = 'released'), 0)                       AS call_platform_fee,
    COALESCE(SUM(amount_paid - ROUND(amount_paid::NUMERIC * 22 / 100)::INTEGER)
             FILTER (WHERE payout_status = 'released'), 0)                       AS call_net,
    COUNT(*)    FILTER (WHERE payout_status = 'refunded')                        AS call_refund_count,
    COALESCE(SUM(amount_paid) FILTER (WHERE payout_status = 'refunded'), 0)      AS call_refund_amount
  FROM public.call_bookings
  WHERE amount_paid > 0
  GROUP BY creator_id, DATE_TRUNC('month', created_at)::DATE
)
INSERT INTO public.creator_monthly_analytics (
  creator_id, month,
  call_count, call_gross, call_platform_fee, call_net,
  call_refund_count, call_refund_amount,
  total_gross, total_platform_fee, total_net, total_refunds
)
SELECT
  creator_id, month,
  call_count, call_gross, call_platform_fee, call_net,
  call_refund_count, call_refund_amount,
  -- Seed totals with call values; merge with message values via DO UPDATE
  call_gross, call_platform_fee, call_net, call_refund_amount
FROM call_stats
ON CONFLICT (creator_id, month) DO UPDATE SET
  call_count         = EXCLUDED.call_count,
  call_gross         = EXCLUDED.call_gross,
  call_platform_fee  = EXCLUDED.call_platform_fee,
  call_net           = EXCLUDED.call_net,
  call_refund_count  = EXCLUDED.call_refund_count,
  call_refund_amount = EXCLUDED.call_refund_amount,
  -- Add call values on top of whatever messages already contributed
  total_gross        = creator_monthly_analytics.total_gross        + EXCLUDED.call_gross,
  total_platform_fee = creator_monthly_analytics.total_platform_fee + EXCLUDED.call_platform_fee,
  total_net          = creator_monthly_analytics.total_net          + EXCLUDED.call_net,
  total_refunds      = creator_monthly_analytics.total_refunds      + EXCLUDED.call_refund_amount,
  updated_at         = NOW();

-- ── Step C: Shop from shop_orders ──
WITH shop_stats AS (
  SELECT
    creator_id,
    DATE_TRUNC('month', created_at)::DATE                                        AS month,
    COUNT(*)    FILTER (WHERE status = 'completed')                              AS shop_order_count,
    COALESCE(SUM(amount_paid) FILTER (WHERE status = 'completed'), 0)            AS shop_gross,
    COALESCE(SUM(ROUND(amount_paid::NUMERIC * 22 / 100)::INTEGER)
             FILTER (WHERE status = 'completed'), 0)                             AS shop_platform_fee,
    COALESCE(SUM(amount_paid - ROUND(amount_paid::NUMERIC * 22 / 100)::INTEGER)
             FILTER (WHERE status = 'completed'), 0)                             AS shop_net,
    COUNT(*)    FILTER (WHERE status = 'refunded')                               AS shop_refund_count,
    COALESCE(SUM(amount_paid) FILTER (WHERE status = 'refunded'), 0)             AS shop_refund_amount
  FROM public.shop_orders
  GROUP BY creator_id, DATE_TRUNC('month', created_at)::DATE
)
INSERT INTO public.creator_monthly_analytics (
  creator_id, month,
  shop_order_count, shop_gross, shop_platform_fee, shop_net,
  shop_refund_count, shop_refund_amount,
  total_gross, total_platform_fee, total_net, total_refunds
)
SELECT
  creator_id, month,
  shop_order_count, shop_gross, shop_platform_fee, shop_net,
  shop_refund_count, shop_refund_amount,
  shop_gross, shop_platform_fee, shop_net, shop_refund_amount
FROM shop_stats
ON CONFLICT (creator_id, month) DO UPDATE SET
  shop_order_count  = EXCLUDED.shop_order_count,
  shop_gross        = EXCLUDED.shop_gross,
  shop_platform_fee = EXCLUDED.shop_platform_fee,
  shop_net          = EXCLUDED.shop_net,
  shop_refund_count = EXCLUDED.shop_refund_count,
  shop_refund_amount = EXCLUDED.shop_refund_amount,
  -- Add shop values on top of messages + calls already accumulated
  total_gross        = creator_monthly_analytics.total_gross        + EXCLUDED.shop_gross,
  total_platform_fee = creator_monthly_analytics.total_platform_fee + EXCLUDED.shop_platform_fee,
  total_net          = creator_monthly_analytics.total_net          + EXCLUDED.shop_net,
  total_refunds      = creator_monthly_analytics.total_refunds      + EXCLUDED.shop_refund_amount,
  updated_at         = NOW();


-- ── 8. Add to realtime publication ───────────────────────────────────────────
-- Allows the Angular dashboard to receive live updates as new transactions
-- come in (e.g. a payment completes while the dashboard is open).

ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_monthly_analytics;
