-- RLS policies for availability_slots and call_bookings tables

-- Enable RLS
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_bookings ENABLE ROW LEVEL SECURITY;

-- ==================== AVAILABILITY SLOTS ====================

-- Creators can view their own availability
CREATE POLICY "Creators can view own availability"
  ON public.availability_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = availability_slots.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can insert their own availability
CREATE POLICY "Creators can insert own availability"
  ON public.availability_slots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = availability_slots.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can update their own availability
CREATE POLICY "Creators can update own availability"
  ON public.availability_slots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = availability_slots.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can delete their own availability
CREATE POLICY "Creators can delete own availability"
  ON public.availability_slots FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = availability_slots.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Public can view availability for active creators (needed for booking page)
CREATE POLICY "Public can view creator availability"
  ON public.availability_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = availability_slots.creator_id
      AND creators.is_active = true
    )
  );

-- ==================== CALL BOOKINGS ====================

-- Creators can view their own bookings
CREATE POLICY "Creators can view own bookings"
  ON public.call_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = call_bookings.creator_id
      AND creators.user_id = auth.uid()
    )
  );

-- Creators can update their own bookings (e.g., confirm, cancel)
CREATE POLICY "Creators can update own bookings"
  ON public.call_bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creators
      WHERE creators.id = call_bookings.creator_id
      AND creators.user_id = auth.uid()
    )
  );
