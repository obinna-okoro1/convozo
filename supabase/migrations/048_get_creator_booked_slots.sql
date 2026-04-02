-- Migration 048: Slot-blocking function for public call-booking form
--
-- The call-booking form (shown to unauthenticated visitors) must hide time slots
-- that are already taken. Anonymous users cannot directly query call_bookings
-- (RLS only allows creators and the booking owner to read rows). This SECURITY
-- DEFINER function returns only scheduled_at values — no PII, no tokens — so
-- the booking form can filter out taken slots without exposing sensitive data.
--
-- Returns: scheduled_at (timestamptz) for every confirmed or in-progress booking
-- for the given creator that falls at or after p_after_ts.

CREATE OR REPLACE FUNCTION public.get_creator_booked_slots(
  p_creator_id uuid,
  p_after_ts   timestamptz DEFAULT now()
)
RETURNS TABLE (scheduled_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cb.scheduled_at
  FROM   public.call_bookings cb
  WHERE  cb.creator_id = p_creator_id
    AND  cb.status IN ('confirmed', 'in_progress')
    AND  cb.scheduled_at >= p_after_ts;
$$;

-- Allow both anonymous visitors (booking form) and authenticated users to call this.
GRANT EXECUTE ON FUNCTION public.get_creator_booked_slots(uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.get_creator_booked_slots(uuid, timestamptz) TO authenticated;

COMMENT ON FUNCTION public.get_creator_booked_slots(uuid, timestamptz) IS
  'Returns only scheduled_at timestamps for confirmed/in-progress bookings so the '
  'public booking form can hide taken slots. No PII or sensitive columns exposed.';
