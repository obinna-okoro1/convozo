-- Migration 038: Add title column to creator_posts
-- Posts can now have an optional short title displayed above the content.
-- Nullable so existing posts remain valid without backfilling.

ALTER TABLE public.creator_posts
  ADD COLUMN IF NOT EXISTS title text;
