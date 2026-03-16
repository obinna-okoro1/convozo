-- ============================================================================
-- Migration 025: Add fan_timezone to call_bookings
--
-- Stores the IANA timezone string of the fan at the time of booking.
-- Enables human-readable display of scheduled_at in the creator's
-- dashboard without ambiguity about what local time the fan selected.
--
-- fan_timezone defaults to 'UTC' so all existing rows remain valid.
-- New bookings always supply the fan's browser timezone.
-- ============================================================================

ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS fan_timezone TEXT NOT NULL DEFAULT 'UTC';

COMMENT ON COLUMN public.call_bookings.fan_timezone IS
  'IANA timezone string captured from fan browser at booking time (e.g. "America/New_York")';
