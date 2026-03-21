-- Migration: Drop all Instagram-related columns
-- Removes instagram_username from creators, sender_instagram from messages,
-- and booker_instagram from call_bookings. Instagram is no longer collected.

-- Drop index before dropping column
DROP INDEX IF EXISTS public.idx_creators_instagram_username;

ALTER TABLE public.creators
  DROP COLUMN IF EXISTS instagram_username;

ALTER TABLE public.messages
  DROP COLUMN IF EXISTS sender_instagram;

-- booker_instagram was NOT NULL in the original schema; dropping is safe.
ALTER TABLE public.call_bookings
  DROP COLUMN IF EXISTS booker_instagram;
