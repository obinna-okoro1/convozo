-- Migration 029: Restrict anon access to call_bookings
--
-- SECURITY FIX: Migration 028 granted anon SELECT USING (true) on call_bookings,
-- which exposed ALL columns to any unauthenticated user who knows a booking UUID.
-- The sensitive columns that were exposed include:
--   • fan_access_token        — allows anyone with the booking_id to join the call as the fan
--   • creator_meeting_token   — Daily.co JWT granting direct room access as creator
--   • fan_meeting_token       — Daily.co JWT granting direct room access as fan
--   • booker_email            — personal data
--   • call_notes              — private message content
--   • stripe_session_id       — Stripe session identifier
--   • stripe_payment_intent_id — Stripe payment identifier
--
-- FIX: Drop the permissive anon SELECT policy. Replace with a SECURITY DEFINER
-- function that returns only the non-sensitive columns the fan page actually needs.
-- Realtime subscriptions are migrated from postgres_changes to Supabase Realtime
-- broadcast (sent by join-call Edge Function), which requires no table SELECT access.
--
-- Non-sensitive columns returned to anon callers:
--   id, status, duration, scheduled_at, fan_timezone, call_started_at,
--   creator_joined_at, fan_joined_at, booker_name, creator_id
-- ─────────────────────────────────────────────────────────────────────────────────

-- Drop the overly-permissive anon SELECT policy from migration 028
DROP POLICY IF EXISTS "Public can view call booking status by id" ON public.call_bookings;

-- Create a SECURITY DEFINER function so anon callers can read only safe status
-- fields for a specific booking — without ever touching the underlying table directly.
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS, but the
-- function itself restricts which columns are returned (no sensitive data).
CREATE OR REPLACE FUNCTION public.get_call_status(p_booking_id uuid)
RETURNS TABLE (
  id                 uuid,
  status             text,
  duration           integer,
  scheduled_at       timestamptz,
  fan_timezone       text,
  call_started_at    timestamptz,
  creator_joined_at  timestamptz,
  fan_joined_at      timestamptz,
  booker_name        text,
  creator_id         uuid
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT
    cb.id,
    cb.status,
    cb.duration,
    cb.scheduled_at,
    cb.fan_timezone,
    cb.call_started_at,
    cb.creator_joined_at,
    cb.fan_joined_at,
    cb.booker_name,
    cb.creator_id
  FROM public.call_bookings cb
  WHERE cb.id = p_booking_id;
$$;

-- Allow both anon (fans) and authenticated (creators) to call this function.
-- Creators can also query call_bookings directly via their existing authenticated RLS policies.
GRANT EXECUTE ON FUNCTION public.get_call_status(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_call_status(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_call_status(uuid) IS
  'Returns non-sensitive booking status fields for the video room page. '
  'Safe to call as anon — does not expose fan_access_token, meeting tokens, emails, or payment IDs.';
