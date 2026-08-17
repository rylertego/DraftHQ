-- C2 follow-up: create the league-assets bucket that LeagueSettingsForm has
-- been uploading to all along.
--
-- The bucket never existed. `uploadLeagueAsset` swallowed the storage error and
-- fell through to a canvas fallback that resized the image to 256px and stored
-- it as a base64 data URL in leagues.logo_url — a ~200KB string shipped on every
-- workspace load, and the real reason league logos look blurry on the TV.
--
-- Path convention is {league_id}/{type}.{ext}, the stable UUID prefix the TODO
-- in 20260629000012_harden_draft_storage_policies.sql called for, so writes can
-- be scoped to the commissioner via is_league_commissioner().

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'league-assets',
  'league-assets',
  true,
  4194304,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Public read: logos and banners render on the TV, the lobby, and shared links.
drop policy if exists "league_assets_read" on storage.objects;
create policy "league_assets_read"
  on storage.objects for select
  using (bucket_id = 'league-assets');

drop policy if exists "league_assets_insert" on storage.objects;
create policy "league_assets_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'league-assets'
    and public.is_league_commissioner((storage.foldername(name))[1]::uuid)
  );

-- Update covers the upsert path: replacing a logo keeps the same object name.
drop policy if exists "league_assets_update" on storage.objects;
create policy "league_assets_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'league-assets'
    and public.is_league_commissioner((storage.foldername(name))[1]::uuid)
  );

-- Delete lets the client clear a stale object when the file extension changes
-- (logo.png replaced by logo.webp) instead of orphaning it in the bucket.
drop policy if exists "league_assets_delete" on storage.objects;
create policy "league_assets_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'league-assets'
    and public.is_league_commissioner((storage.foldername(name))[1]::uuid)
  );
