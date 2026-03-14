-- Add missing DELETE RLS policy on call_bookings.
-- Without this, creators cannot delete completed/cancelled bookings from
-- the dashboard because RLS silently blocks the delete (returns 0 rows).

CREATE POLICY "Creators can delete own bookings"
  ON public.call_bookings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = call_bookings.creator_id
      AND creators.user_id = auth.uid()
    )
  );
