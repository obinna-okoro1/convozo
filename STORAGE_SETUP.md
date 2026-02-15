# Storage Setup Guide

## Creating the Storage Bucket

Since the migration hasn't been applied yet, you can create the storage bucket manually through Supabase Studio:

1. **Open Supabase Studio**: http://127.0.0.1:54323

2. **Navigate to Storage**:
   - Click on "Storage" in the left sidebar
   - Click "Create a new bucket"

3. **Create Public Bucket**:
   - Bucket name: `public`
   - Make sure "Public bucket" is checked ✓
   - Click "Create bucket"

4. **The RLS policies are already in the migration file** (`003_storage_buckets.sql`), but if needed, add these policies manually:

### Alternative: Apply Migration via SQL Editor

1. Go to SQL Editor in Supabase Studio
2. Run this SQL:

```sql
-- Create storage bucket
insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to avatars folder
create policy if not exists "Authenticated users can upload to avatars folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'public' and
  (storage.foldername(name))[1] = 'avatars'
);

-- Allow public read access
create policy if not exists "Public read access"
on storage.objects for select
to public
using (bucket_id = 'public');

-- Allow users to update their own files
create policy if not exists "Users can update their own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'public' and
  auth.uid()::text = (storage.foldername(name))[2]
)
with check (
  bucket_id = 'public' and
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to delete their own files
create policy if not exists "Users can delete their own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'public' and
  auth.uid()::text = (storage.foldername(name))[2]
);
```

## Testing the Upload

1. Log in to your app: http://localhost:4200/auth/login
2. Use test credentials: `creator@example.com` / `sample123`
3. Navigate to Settings: http://localhost:4200/creator/settings
4. Click "Upload Photo" and select an image
5. The image should upload and display immediately

## File Structure

Uploaded files will be stored at:
- Path: `avatars/{user_id}-{timestamp}.{extension}`
- Example: `avatars/123e4567-e89b-12d3-a456-426614174000-1704067200000.jpg`
- Public URL: `http://127.0.0.1:54321/storage/v1/object/public/public/avatars/{filename}`

## Features Implemented

- ✅ File upload with preview
- ✅ Image validation (type and size)
- ✅ Loading states
- ✅ Error handling
- ✅ Remove/change photo
- ✅ Automatic public URL generation
- ✅ 2MB file size limit
- ✅ Only image files accepted
