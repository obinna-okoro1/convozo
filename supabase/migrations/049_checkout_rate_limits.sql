-- ============================================================================
-- Migration 049: Checkout rate limits table
--
-- Replaces the per-process in-memory rate limiter in create-checkout-session
-- and create-call-booking-session with a shared DB-backed counter.
--
-- Why: Edge Function instances are ephemeral and isolated — each warm instance
-- has its own counter, so the in-memory limiter is easily bypassed by spam
-- hitting multiple instances. A DB table shared across all instances is the
-- correct solution without requiring external infrastructure (Redis/Upstash).
--
-- Schema:
--   key          — hashed identifier (sha256 of "action:email" to avoid
--                  storing raw email addresses in this table)
--   window_start — UTC truncated to the current 1-hour window
--   count        — number of requests in this window
--   last_seen_at — timestamp of most recent request (for monitoring)
--
-- The Edge Function uses an upsert that increments the counter atomically.
-- Rows are cleaned up by the pg_cron job defined below (hourly).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.checkout_rate_limits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, window_start)
);

-- Index for the cron cleanup query
CREATE INDEX IF NOT EXISTS idx_checkout_rate_limits_window
  ON public.checkout_rate_limits (window_start);

-- RLS: Edge Functions use the service_role key which bypasses RLS.
-- No client should ever read or write this table directly.
ALTER TABLE public.checkout_rate_limits ENABLE ROW LEVEL SECURITY;

-- No RLS policies — service_role only. Deny all client access.
-- (Absence of policies = deny all for non-service_role roles)

-- ── RPC: atomic upsert used by checkDbRateLimit() in _shared/http.ts ────────
-- Inserts a new row with count=1 or increments an existing row.
-- Returns the updated count so the caller can compare against the max in one
-- round-trip.
CREATE OR REPLACE FUNCTION public.upsert_checkout_rate_limit(
  p_key          TEXT,
  p_window_start TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as owner (postgres), bypasses RLS
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.checkout_rate_limits (key, window_start, count, last_seen_at)
  VALUES (p_key, p_window_start, 1, NOW())
  ON CONFLICT (key, window_start)
  DO UPDATE SET
    count        = checkout_rate_limits.count + 1,
    last_seen_at = NOW()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

-- ── Cleanup cron: delete rows older than 2 hours (double the window) ────────
-- Runs hourly, same schedule as existing crons in migration 046.
-- We keep 2 hours so a window straddling the hour boundary doesn't lose counts.
SELECT cron.schedule(
  'cleanup-checkout-rate-limits',
  '0 * * * *',  -- every hour
  $$
    DELETE FROM public.checkout_rate_limits
    WHERE window_start < NOW() - INTERVAL '2 hours';
  $$
);
