-- Add banner_image_url column to creators table.
-- Stores either a Supabase Storage URL (custom upload) or a relative path
-- to a preset banner image (e.g. '/assets/banners/banner-1.jpg').
ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS banner_image_url TEXT;
