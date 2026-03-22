-- ============================================================================
-- Migration 032: Separate Support/Donation Analytics
--
-- Prior to this migration, all payments routed through the payments table
-- (DMs, follow-backs, AND support tips) were lumped into message_* columns
-- in creator_monthly_analytics.
--
-- This migration:
--   1. Adds dedicated support_* columns for fan tips / donations.
--   2. Back-fills existing rows by moving support payments out of message_*.
--   3. Replaces the payment trigger so it routes by message_type:
--        'support'                 → support_* columns
--        'message' | 'follow_back' → message_* columns
--        NULL (orphaned payment)   → message_* columns (safe default)
--
-- All monetary values remain INTEGER CENTS. No floating point.
-- total_gross / total_net / total_refunds are unaffected — they roll up
-- all streams and did not need changing.
-- ============================================================================


-- ── 1. Add support stream columns ────────────────────────────────────────────

ALTER TABLE public.creator_monthly_analytics
  ADD COLUMN IF NOT EXISTS support_count         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS support_gross         INTEGER NOT NULL DEFAULT 0,  -- cents
  ADD COLUMN IF NOT EXISTS support_platform_fee  INTEGER NOT NULL DEFAULT 0,  -- cents
  ADD COLUMN IF NOT EXISTS support_net           INTEGER NOT NULL DEFAULT 0,  -- cents
  ADD COLUMN IF NOT EXISTS support_refund_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS support_refund_amount INTEGER NOT NULL DEFAULT 0;  -- cents


-- ── 2. Back-fill: move existing support payments into the new columns ─────────
--
-- Computes, for every (creator, month) pair, the aggregated support payments
-- from the payments + messages tables, then atomically:
--   • Subtracts them from message_* (where they were previously counted)
--   • Writes them into support_*
--
-- Uses a CTE so the subtraction and addition happen in one pass.

WITH support_agg AS (
  SELECT
    p.creator_id,
    DATE_TRUNC('month', p.created_at)::DATE                                     AS month,
    COUNT(*)          FILTER (WHERE p.status = 'completed')                     AS s_count,
    COALESCE(SUM(p.amount)          FILTER (WHERE p.status = 'completed'), 0)   AS s_gross,
    COALESCE(SUM(p.platform_fee)    FILTER (WHERE p.status = 'completed'), 0)   AS s_fee,
    COALESCE(SUM(p.creator_amount)  FILTER (WHERE p.status = 'completed'), 0)   AS s_net,
    COUNT(*)          FILTER (WHERE p.status = 'refunded')                      AS s_refund_count,
    COALESCE(SUM(p.amount)          FILTER (WHERE p.status = 'refunded'), 0)    AS s_refund_amount
  FROM public.payments p
  JOIN public.messages m ON m.id = p.message_id
  WHERE m.message_type = 'support'
    AND p.status IN ('completed', 'refunded')
  GROUP BY p.creator_id, DATE_TRUNC('month', p.created_at)::DATE
)
UPDATE public.creator_monthly_analytics a
SET
  -- Remove from message_* bucket
  message_count         = a.message_count         - sa.s_count,
  message_gross         = a.message_gross         - sa.s_gross,
  message_platform_fee  = a.message_platform_fee  - sa.s_fee,
  message_net           = a.message_net           - sa.s_net,
  message_refund_count  = a.message_refund_count  - sa.s_refund_count,
  message_refund_amount = a.message_refund_amount - sa.s_refund_amount,
  -- Write into support_* bucket
  support_count         = sa.s_count,
  support_gross         = sa.s_gross,
  support_platform_fee  = sa.s_fee,
  support_net           = sa.s_net,
  support_refund_count  = sa.s_refund_count,
  support_refund_amount = sa.s_refund_amount
FROM support_agg sa
WHERE a.creator_id = sa.creator_id
  AND a.month      = sa.month;


-- ── 3. Replace payment trigger — now routes by message_type ──────────────────

CREATE OR REPLACE FUNCTION public.trg_analytics_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month        DATE := DATE_TRUNC('month', NEW.created_at)::DATE;
  v_message_type TEXT;
BEGIN
  PERFORM public.analytics_ensure_row(NEW.creator_id, v_month);

  -- Resolve the message_type from the linked message.
  -- Will be NULL if the message was deleted (ON DELETE SET NULL on payments.message_id).
  -- NULL payments are treated as 'message' type (safe legacy default).
  SELECT message_type INTO v_message_type
  FROM public.messages
  WHERE id = NEW.message_id;

  -- ── New completed payment ──────────────────────────────────────────────────
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed')
  OR (TG_OP = 'UPDATE' AND OLD.status <> 'completed' AND NEW.status = 'completed')
  THEN

    IF v_message_type = 'support' THEN
      UPDATE public.creator_monthly_analytics
      SET
        support_count        = support_count        + 1,
        support_gross        = support_gross        + NEW.amount,
        support_platform_fee = support_platform_fee + NEW.platform_fee,
        support_net          = support_net          + NEW.creator_amount,
        total_gross          = total_gross          + NEW.amount,
        total_platform_fee   = total_platform_fee   + NEW.platform_fee,
        total_net            = total_net            + NEW.creator_amount
      WHERE creator_id = NEW.creator_id AND month = v_month;

    ELSE
      -- 'message', 'follow_back', NULL (orphaned/legacy) → message bucket
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
    END IF;

  -- ── Payment refunded ───────────────────────────────────────────────────────
  ELSIF TG_OP = 'UPDATE'
    AND OLD.status <> 'refunded'
    AND NEW.status  = 'refunded'
  THEN

    IF v_message_type = 'support' THEN
      UPDATE public.creator_monthly_analytics
      SET
        support_refund_count  = support_refund_count  + 1,
        support_refund_amount = support_refund_amount + NEW.amount,
        -- Reverse net only if the payment had previously been recognised
        support_net           = CASE WHEN OLD.status = 'completed'
                                  THEN support_net - OLD.creator_amount
                                  ELSE support_net
                                END,
        total_refunds         = total_refunds + NEW.amount,
        total_net             = CASE WHEN OLD.status = 'completed'
                                  THEN total_net - OLD.creator_amount
                                  ELSE total_net
                                END
      WHERE creator_id = NEW.creator_id AND month = v_month;

    ELSE
      UPDATE public.creator_monthly_analytics
      SET
        message_refund_count  = message_refund_count  + 1,
        message_refund_amount = message_refund_amount + NEW.amount,
        message_net           = CASE WHEN OLD.status = 'completed'
                                  THEN message_net - OLD.creator_amount
                                  ELSE message_net
                                END,
        total_refunds         = total_refunds + NEW.amount,
        total_net             = CASE WHEN OLD.status = 'completed'
                                  THEN total_net - OLD.creator_amount
                                  ELSE total_net
                                END
      WHERE creator_id = NEW.creator_id AND month = v_month;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- The trigger binding itself is unchanged (same name, same table, same events).
-- Replacing the function above is sufficient — no DROP/CREATE TRIGGER needed.
