-- Create storage bucket for public files (profile pictures, etc.)
insert into storage.buckets (id, name, public)
values ('public', 'public', true);

-- Allow authenticated users to upload their own profile pictures
create policy "Authenticated users can upload to avatars folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'public' and
  (storage.foldername(name))[1] = 'avatars'
);

-- Allow public read access to all files in public bucket
create policy "Public read access"
on storage.objects for select
to public
using (bucket_id = 'public');

-- Allow users to update their own files
create policy "Users can update their own files"
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
create policy "Users can delete their own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'public' and
  auth.uid()::text = (storage.foldername(name))[2]
);
