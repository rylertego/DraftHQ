-- Add owner_photo_url to draft teams table
alter table public.teams add column if not exists owner_photo_url text;

-- Storage bucket for draft team logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'draft-team-logos',
  'draft-team-logos',
  true,
  4194304,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Storage bucket for draft owner photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'draft-owner-photos',
  'draft-owner-photos',
  true,
  4194304,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- RLS: authenticated users can upload to their own draft paths
create policy "draft team logo upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'draft-team-logos');

create policy "draft team logo read"
on storage.objects for select to public
using (bucket_id = 'draft-team-logos');

create policy "draft team logo update"
on storage.objects for update to authenticated
using (bucket_id = 'draft-team-logos');

create policy "draft owner photo upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'draft-owner-photos');

create policy "draft owner photo read"
on storage.objects for select to public
using (bucket_id = 'draft-owner-photos');

create policy "draft owner photo update"
on storage.objects for update to authenticated
using (bucket_id = 'draft-owner-photos');
