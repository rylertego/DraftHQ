-- Storage bucket for league team logos
-- Path convention: {league_id}/{team_id}/logo.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'league-team-logos',
  'league-team-logos',
  true,
  4194304,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Public read
create policy "league_team_logos_read"
  on storage.objects for select
  using (bucket_id = 'league-team-logos');

-- Commissioner upload (insert)
create policy "league_team_logos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'league-team-logos'
    and public.is_league_commissioner((storage.foldername(name))[1]::uuid)
  );

-- Commissioner replace (update)
create policy "league_team_logos_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'league-team-logos'
    and public.is_league_commissioner((storage.foldername(name))[1]::uuid)
  );
