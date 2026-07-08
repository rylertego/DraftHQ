-- C2: Storage policy hardening for draft buckets.
-- league-team-logos is already scoped by is_league_commissioner — leave it.
-- draft-team-logos and draft-owner-photos: path is {draft_id}/{team_id}/...
--   Allow commissioner or the assigned team owner.
-- draft-audio: path is {draft_id}/...
--   Commissioner-only.

-- Helper: current user is the draft commissioner OR owns the specific team.
-- Path convention for team asset buckets: {draft_id}/{team_id}/filename
create or replace function public.can_manage_draft_team_asset(
  p_draft_id uuid,
  p_team_id  uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    -- Commissioner authority (authoritative field)
    exists (
      select 1 from public.drafts
      where id = p_draft_id
        and commissioner_user_id = auth.uid()
    )
    or
    -- Assigned team owner
    exists (
      select 1 from public.draft_participants
      where draft_id = p_draft_id
        and user_id   = auth.uid()
        and team_id   = p_team_id
        and role in ('commissioner', 'owner')
    );
$$;

revoke all on function public.can_manage_draft_team_asset(uuid, uuid) from public, anon;
grant execute on function public.can_manage_draft_team_asset(uuid, uuid) to authenticated;

-- ── draft-team-logos ──────────────────────────────────────────────────────────

drop policy if exists "draft team logo upload" on storage.objects;
drop policy if exists "draft team logo update" on storage.objects;

create policy "draft team logo upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'draft-team-logos'
    and public.can_manage_draft_team_asset(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

create policy "draft team logo update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'draft-team-logos'
    and public.can_manage_draft_team_asset(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

-- ── draft-owner-photos ────────────────────────────────────────────────────────

drop policy if exists "draft owner photo upload" on storage.objects;
drop policy if exists "draft owner photo update" on storage.objects;

create policy "draft owner photo upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'draft-owner-photos'
    and public.can_manage_draft_team_asset(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

create policy "draft owner photo update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'draft-owner-photos'
    and public.can_manage_draft_team_asset(
      (storage.foldername(name))[1]::uuid,
      (storage.foldername(name))[2]::uuid
    )
  );

-- ── draft-audio ───────────────────────────────────────────────────────────────
-- Path: {draft_id}/sfx1.mp3 | sfx2.mp3 | pickIsIn.mp3 | draftStart.mp3

drop policy if exists "draft audio upload" on storage.objects;
drop policy if exists "draft audio update" on storage.objects;
drop policy if exists "draft audio delete" on storage.objects;

create policy "draft audio upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'draft-audio'
    and public.is_draft_commissioner((storage.foldername(name))[1]::uuid)
  );

create policy "draft audio update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'draft-audio'
    and public.is_draft_commissioner((storage.foldername(name))[1]::uuid)
  );

create policy "draft audio delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'draft-audio'
    and public.is_draft_commissioner((storage.foldername(name))[1]::uuid)
  );

-- Note: league-assets bucket (logo/banner uploads in LeagueSettingsForm) has
-- no migration definition. That bucket was likely created manually in the
-- dashboard. Its path format ({folder}/{leagueId}-{timestamp}.ext) cannot
-- be safely policy-checked by commissioner role without a stable UUID prefix.
-- TODO: migrate league logo/banner uploads to league-team-logos or a new
--       league-assets bucket with path {league_id}/{type}.{ext}.
