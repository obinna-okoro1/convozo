-- Add a secret, unguessable token for fan call access.
-- The fan's join link includes this token as proof they received the email.
-- Without it, knowing a booking UUID alone is not enough to join.

ALTER TABLE public.call_bookings
  ADD COLUMN IF NOT EXISTS fan_access_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Ensure uniqueness so tokens can never collide
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_bookings_fan_access_token
  ON public.call_bookings(fan_access_token);

-- Backfill any existing rows that might have NULL (shouldn't happen with DEFAULT,
-- but defensive for rows created before this migration in edge cases)
UPDATE public.call_bookings
  SET fan_access_token = gen_random_uuid()
  WHERE fan_access_token IS NULL;
