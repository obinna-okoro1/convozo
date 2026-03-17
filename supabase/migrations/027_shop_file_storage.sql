-- ============================================================================
-- Migration 027: Shop File Storage
--
-- Transitions the digital shop from external download URLs to files hosted
-- in Supabase Storage. Creators upload files directly to our app; buyers
-- download securely from the success page via a signed-URL edge function.
--
-- Changes:
--   1. Add file_storage_path to shop_items (private storage path in shop-files)
--   2. Add thumbnail_storage_path to shop_items (public path in shop-thumbnails)
--   3. Create shop-files bucket (private — signed URLs only)
--   4. Create shop-thumbnails bucket (public reads)
--   5. Storage RLS policies for both buckets
-- ============================================================================

-- ── 1. New columns on shop_items ─────────────────────────────────────────────

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS file_storage_path     TEXT,   -- path in private shop-files bucket
  ADD COLUMN IF NOT EXISTS thumbnail_storage_path TEXT;  -- path in public shop-thumbnails bucket

-- ── 2. shop-files bucket (private — downloads via signed URL only) ─────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-files',
  'shop-files',
  false,
  524288000, -- 500 MB max per file
  ARRAY[
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/x-m4a',
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/zip', 'application/x-zip-compressed',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. shop-thumbnails bucket (public reads, authenticated uploads) ────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shop-thumbnails',
  'shop-thumbnails',
  true,
  10485760, -- 10 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. RLS policies for shop-files ───────────────────────────────────────────

-- Creators upload their own files (folder must match their creator_id)
CREATE POLICY "shop_files_creator_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creators can read their own files (for management UI preview)
CREATE POLICY "shop_files_creator_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'shop-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creators can delete their own files (e.g. when removing a shop item)
CREATE POLICY "shop_files_creator_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shop-files'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- ── 5. RLS policies for shop-thumbnails ──────────────────────────────────────

-- Public bucket — anyone can read
CREATE POLICY "shop_thumbnails_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'shop-thumbnails');

-- Creators can upload thumbnails under their own folder
CREATE POLICY "shop_thumbnails_creator_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shop-thumbnails'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.creators WHERE user_id = auth.uid()
    )
  );

-- Creators can delete their own thumbnails
CREATE POLICY "shop_thumbnails_creator_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shop-thumbnails'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.creators WHERE user_id = auth.uid()
    )
  );
