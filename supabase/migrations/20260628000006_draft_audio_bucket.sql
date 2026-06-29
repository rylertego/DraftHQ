-- Storage bucket for commissioner-uploaded SFX audio files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'draft-audio',
  'draft-audio',
  true,
  8388608,
  array['audio/mpeg','audio/mp3','audio/wav','audio/ogg','audio/x-m4a','audio/mp4','audio/aac']
)
on conflict (id) do nothing;

create policy "draft audio upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'draft-audio');

create policy "draft audio read"
on storage.objects for select to public
using (bucket_id = 'draft-audio');

create policy "draft audio update"
on storage.objects for update to authenticated
using (bucket_id = 'draft-audio');

create policy "draft audio delete"
on storage.objects for delete to authenticated
using (bucket_id = 'draft-audio');
