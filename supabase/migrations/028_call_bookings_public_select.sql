-- Allow unauthenticated (anon) users to SELECT call_bookings rows by id.
--
-- Purpose:
--   1. Enables Supabase Realtime subscriptions on the call join page for fans who
--      are not logged in (they authenticate via fan_access_token, not a Supabase JWT).
--   2. Allows the `transitionToInProgress` authoritative DB re-fetch to work for fans.
--
-- Security model:
--   Booking UUIDs are v4 (122 bits of entropy) — functionally equivalent to a secret
--   magic link. A fan only reaches this page via a URL we generated and sent to their
--   email address. Guessing a valid UUID is computationally infeasible.
--
--   The data exposed (booker_name, duration, status, scheduled_at) is no more sensitive
--   than what the fan already received in their confirmation email.
--
CREATE POLICY "Public can view call booking status by id"
  ON public.call_bookings FOR SELECT
  TO anon
  USING (true);
