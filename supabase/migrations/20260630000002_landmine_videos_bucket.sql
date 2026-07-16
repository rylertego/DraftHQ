-- Landmine videos: commissioner-uploaded clips played full-screen when a
-- landmine pick lands, instead of the built-in bomb animation.
-- Path convention: {draft_id}/landmine-{timestamp}.{ext}
-- No drafts column needed — the video pool for a draft is simply the
-- contents of its folder, listed by clients at room load.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'draft-videos',
  'draft-videos',
  true,
  26214400, -- 25 MB per clip
  array['video/mp4', 'video/webm']
)
on conflict (id) do nothing;

drop policy if exists "draft videos public read" on storage.objects;
create policy "draft videos public read"
  on storage.objects for select
  using (bucket_id = 'draft-videos');

drop policy if exists "draft videos upload" on storage.objects;
create policy "draft videos upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'draft-videos'
    and public.is_draft_commissioner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "draft videos update" on storage.objects;
create policy "draft videos update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'draft-videos'
    and public.is_draft_commissioner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "draft videos delete" on storage.objects;
create policy "draft videos delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'draft-videos'
    and public.is_draft_commissioner((storage.foldername(name))[1]::uuid)
  );
