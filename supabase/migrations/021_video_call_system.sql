-- ============================================================================
-- Migration 021: Video Call System
--
-- Adds infrastructure for embedded Daily.co video calls with escrow-style
-- payout logic. Extends call_bookings with room/attendance tracking and adds
-- a call_events log for audit + dispute evidence.
--
-- Key changes:
--   1. New columns on call_bookings for Daily room, tokens, attendance, payout
--   2. New 'no_show' status already exists; adds 'in_progress' + 'refunded'
--   3. call_events table — immutable audit log of join/leave/complete/no-show
--   4. RLS policies for call_events
-- ============================================================================

-- ── 1. Extend call_bookings ──────────────────────────────────────────────────

-- Daily.co room identifiers
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS daily_room_name TEXT,
  ADD COLUMN IF NOT EXISTS daily_room_url  TEXT;

-- Meeting tokens (JWT) for secure room access — one per participant
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS creator_meeting_token TEXT,
  ADD COLUMN IF NOT EXISTS fan_meeting_token     TEXT;

-- Attendance timestamps — set by the join-call Edge Function
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS creator_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fan_joined_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_ended_at     TIMESTAMPTZ;

-- Actual duration in seconds (computed when call ends)
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS actual_duration_seconds INTEGER;

-- Payout tracking
-- payout_status: 'held' (payment captured, payout pending) → 'released' (creator paid) → 'refunded' (fan refunded)
ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'held'
    CHECK (payout_status IN ('held', 'released', 'refunded'));

ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS payout_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_at        TIMESTAMPTZ;

-- Expand the status CHECK constraint to include new states
-- First drop the existing constraint, then recreate with expanded values
ALTER TABLE public.call_bookings
  DROP CONSTRAINT IF EXISTS call_bookings_status_check;

ALTER TABLE public.call_bookings
  ADD CONSTRAINT call_bookings_status_check
    CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'refunded'));

-- Index for looking up bookings by room name (used by join-call function)
CREATE INDEX IF NOT EXISTS idx_call_bookings_daily_room
  ON public.call_bookings (daily_room_name)
  WHERE daily_room_name IS NOT NULL;

-- ── 2. call_events — immutable audit log ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.call_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES public.call_bookings(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'room_created',
    'creator_joined',
    'fan_joined',
    'call_started',
    'creator_left',
    'fan_left',
    'call_ended',
    'call_completed',
    'no_show_creator',
    'no_show_fan',
    'payout_released',
    'refund_issued'
  )),
  actor        TEXT CHECK (actor IN ('creator', 'fan', 'system')),
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup of events for a booking (dispute evidence)
CREATE INDEX IF NOT EXISTS idx_call_events_booking
  ON public.call_events (booking_id, created_at);

-- ── 3. RLS policies ──────────────────────────────────────────────────────────

ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Creators can view events for their own bookings
CREATE POLICY call_events_creator_select ON public.call_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.call_bookings cb
        JOIN public.creators c ON c.id = cb.creator_id
      WHERE cb.id = call_events.booking_id
        AND c.user_id = auth.uid()
    )
  );

-- Only service role inserts events (Edge Functions)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ── 4. Add call_events to realtime publication ───────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.call_events;

-- ── 5. Trigger for updated_at on call_bookings (already exists from 001) ────
-- No action needed — the existing trigger handles updated_at automatically.
