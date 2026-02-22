-- Add instagram_username column to creators table
-- This allows creators to link their public Instagram profile

ALTER TABLE public.creators 
ADD COLUMN IF NOT EXISTS instagram_username TEXT;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creators_instagram_username 
ON public.creators(instagram_username);

-- Add a comment to document the column
COMMENT ON COLUMN public.creators.instagram_username IS 'Instagram username (handle) for displaying public profile content';
