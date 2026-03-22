-- ============================================================================
-- Migration 033: Fix banner image storage policy
--
-- Migration 003 created the storage INSERT policy scoped to the 'avatars'
-- folder only. The image-upload component uploads custom banners to the
-- 'banners' folder, so all custom banner uploads were silently rejected
-- by RLS — the upload call returned a permissions error and the URL was
-- never persisted.
--
-- Fix: replace the restrictive single-folder policy with one that allows
-- uploads to both 'avatars' and 'banners' (and any future media folders
-- under the 'public' bucket), while still enforcing that the user can
-- only write to their own sub-directory.
-- ============================================================================

-- Drop the old policy that only permitted 'avatars'
DROP POLICY IF EXISTS "Authenticated users can upload to avatars folder" ON storage.objects;

-- New policy: allows authenticated users to upload to any recognised
-- media folder inside the public bucket, as long as the second path
-- segment matches their own user ID.
-- Path structure: {folder}/{userId}/{filename}
--   (storage.foldername(name))[1] → folder  ('avatars', 'banners', …)
--   (storage.foldername(name))[2] → userId
CREATE POLICY "Authenticated users can upload media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'public'
    AND (storage.foldername(name))[1] IN ('avatars', 'banners')
    AND auth.uid()::text = (storage.foldername(name))[2]
  );
