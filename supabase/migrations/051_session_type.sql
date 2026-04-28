-- Migration 051: Session type — online, physical, or both
-- Experts can now configure whether their bookable sessions are:
--   'online'   — video call only (existing behaviour)
--   'physical' — in-person at a fixed address only
--   'both'     — client chooses at booking time
-- When 'physical' or 'both', experts must supply a physical_address.
-- call_bookings records what the client actually chose per booking.

-- ── creator_settings ──────────────────────────────────────────────────────────

ALTER TABLE public.creator_settings
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'online'
    CHECK (session_type IN ('online', 'physical', 'both'));

ALTER TABLE public.creator_settings
  ADD COLUMN IF NOT EXISTS physical_address TEXT;

-- ── call_bookings ──────────────────────────────────────────────────────────────

ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'online'
    CHECK (session_type IN ('online', 'physical'));
