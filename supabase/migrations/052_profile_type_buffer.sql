-- Migration 052: Profile type and booking buffer time
--
-- Adds two configurable fields:
-- 1. profile_type on creators — 'consultant' (default) or 'practitioner'
--    Controls UI copy on the public booking page (e.g. "Private Consultation" vs "Book an Appointment")
-- 2. buffer_minutes on creator_settings — dead time between bookings (0–60 min, default 0)
--    Enforced in both the frontend slot generator and the backend conflict check.

-- ── Add profile_type to creators ─────────────────────────────────────────────
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS profile_type TEXT NOT NULL DEFAULT 'consultant'
    CHECK (profile_type IN ('consultant', 'practitioner'));

COMMENT ON COLUMN creators.profile_type IS
  'Controls public-facing copy on the booking page. "consultant" = advisory/coaching copy; "practitioner" = appointment/clinical copy.';

-- ── Add buffer_minutes to creator_settings ────────────────────────────────────
ALTER TABLE creator_settings
  ADD COLUMN IF NOT EXISTS buffer_minutes SMALLINT NOT NULL DEFAULT 0
    CHECK (buffer_minutes >= 0 AND buffer_minutes <= 60);

COMMENT ON COLUMN creator_settings.buffer_minutes IS
  'Dead time (in minutes) between consecutive bookings. Enforced in the frontend slot generator and the backend conflict overlap check.';
