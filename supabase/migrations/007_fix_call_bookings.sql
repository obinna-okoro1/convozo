-- Fix call_bookings table: make scheduled_at nullable
-- Call bookings are initially created without a scheduled time;
-- the creator coordinates the time with the booker after payment.
ALTER TABLE public.call_bookings ALTER COLUMN scheduled_at DROP NOT NULL;

-- Enable Supabase Realtime for call_bookings so the dashboard updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_bookings;

-- Allow the service role (webhook) to insert call bookings
-- The existing RLS policies only allow creators to SELECT and UPDATE their own bookings.
-- We need an INSERT policy for the service role (which bypasses RLS anyway),
-- but let's also add a policy so the anon/authenticated role can read bookings
-- for public confirmation pages if ever needed.
