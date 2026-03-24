-- Migration 036: Remove follow-back feature
-- The follow-back (connection request) feature has been removed from the product.
-- This migration drops the follow_back_price and follow_back_enabled columns from
-- creator_settings, and removes 'follow_back' from the message_type check constraint
-- on the messages table.

-- ── 1. Drop follow-back columns from creator_settings ──────────────────────────
ALTER TABLE public.creator_settings
  DROP COLUMN IF EXISTS follow_back_price,
  DROP COLUMN IF EXISTS follow_back_enabled;

-- ── 2. Update messages.message_type CHECK constraint ───────────────────────────
-- Remove 'follow_back' from the allowed values.
-- We must drop the old constraint and add the new one.
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('message', 'call', 'support'));

-- ── 3. Reclassify any existing follow_back messages as regular messages ─────────
-- Historical follow_back rows should not be lost — treat them as paid messages.
UPDATE public.messages
  SET message_type = 'message'
  WHERE message_type = 'follow_back';
