-- Migration 035: Prevent double-booking on call_bookings
--
-- Problem: Two clients could both pick the same time slot, pay concurrently,
-- and both webhooks would succeed — creating two confirmed bookings for the
-- exact same creator + scheduled_at.
--
-- Fix: A partial unique index that only enforces uniqueness among active
-- bookings (confirmed / in_progress). Cancelled and completed bookings
-- release the slot so it can be re-booked.
--
-- The Edge Function (create-call-booking-session) does an early conflict check
-- before creating the Stripe/Paystack session. This index is the hard
-- safety net that handles the narrow concurrent-payment race window.

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_bookings_no_double_book
  ON public.call_bookings (creator_id, scheduled_at)
  WHERE status IN ('confirmed', 'in_progress');

COMMENT ON INDEX idx_call_bookings_no_double_book IS
  'Prevents two active bookings for the same creator + time slot. '
  'Cancelled/completed bookings are excluded so the slot can be re-booked.';
