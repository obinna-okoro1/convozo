-- Security Hardening Migration
-- Fixes: Storage INSERT policy, file size limit

-- 1. Fix storage INSERT policy: restrict uploads to user's own subfolder
--    Previously any authenticated user could upload to avatars/<anyone>/
DROP POLICY IF EXISTS "Authenticated users can upload to avatars folder" ON storage.objects;

CREATE POLICY "Authenticated users can upload to own avatars folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- 2. Set file size limit on public bucket (5MB max)
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'public';

-- 3. Restrict allowed MIME types for the public bucket (images only)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'public';
