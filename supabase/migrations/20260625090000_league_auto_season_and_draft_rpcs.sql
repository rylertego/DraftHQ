-- 1. Auto-create current-year season when a league is created.
-- 2. create_draft_for_season — add a draft to an existing draftless season.
-- 3. reset_season_draft     — detach/delete the draft from a season.

-- ── 1. create_league: auto-create current-year season ────────────────────────

create or replace function public.create_league(p_name text, p_slug text)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_league  public.leagues%rowtype;
  v_slug    text := lower(trim(p_slug));
  v_year    integer := extract(year from now())::integer;
begin
  if v_user_id is null or auth.jwt() ->> 'is_anonymous' = 'true' then
    raise exception using
      errcode = '42501',
      message = 'A persistent account is required to create a league.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'League name must be between 1 and 100 characters.';
  end if;

  if v_slug is null
    or char_length(v_slug) not between 3 and 60
    or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise exception using
      errcode = '22023',
      message = 'League slug must contain lowercase letters, numbers, and single hyphens.';
  end if;

  insert into public.leagues (slug, name, owner_user_id)
  values (v_slug, trim(p_name), v_user_id)
  returning * into v_league;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_user_id, 'commissioner');

  -- Auto-create the current-year season (no draft yet)
  insert into public.league_seasons (league_id, year, name)
  values (v_league.id, v_year, v_year::text || ' Season');

  return v_league;
end;
$$;

-- ── 2. create_draft_for_season ───────────────────────────────────────────────

create or replace function public.create_draft_for_season(
  p_season_id   uuid,
  p_name        text,
  p_team_count  integer,
  p_rounds      integer,
  p_display_name text
)
returns public.league_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season          public.league_seasons%rowtype;
  v_draft           public.drafts%rowtype;
  v_draft_team      public.teams%rowtype;
  v_league_team_id  uuid;
  v_league_team_count integer;
  v_league_team_name text;
  v_league_team_short_name text;
  v_league_team_logo_url text;
  v_league_team_owner_name text;
  v_owner_user_id   uuid;
  v_owner_display_name text;
begin
  select * into v_season
  from public.league_seasons
  where id = p_season_id;

  if v_season.id is null then
    raise exception using errcode = '22023', message = 'Season not found.';
  end if;

  if not public.is_league_commissioner(v_season.league_id) then
    raise exception using errcode = '42501', message = 'Only the commissioner can create a draft.';
  end if;

  if v_season.draft_id is not null then
    raise exception using errcode = '22023', message = 'This season already has a draft.';
  end if;

  -- Create the draft
  v_draft := public.create_league_draft(p_name, p_team_count, p_rounds, p_display_name, v_season.league_id);

  -- Link draft to season
  update public.league_seasons
  set draft_id = v_draft.id
  where id = p_season_id
  returning * into v_season;

  -- Materialize franchise teams into draft slots (partial fill is fine)
  select count(*)::integer into v_league_team_count
  from public.league_teams
  where league_id = v_season.league_id and archived_at is null;

  if v_league_team_count > p_team_count then
    raise exception using
      errcode = '22023',
      message = 'Active franchise count (' || v_league_team_count || ') exceeds draft team count (' || p_team_count || ').';
  end if;

  if v_league_team_count > 0 then
    for v_draft_team in
      select * from public.teams
      where draft_id = v_draft.id
      order by draft_position
    loop
      -- Find the franchise for this position (may be null if fewer franchises than slots)
      select id into v_league_team_id
      from public.league_teams
      where league_id = v_season.league_id and archived_at is null
      order by created_at, id
      offset v_draft_team.draft_position - 1
      limit 1;

      -- Only populate slots that have a franchise; leave the rest as defaults
      if v_league_team_id is not null then
        select lt.name, lt.short_name, lt.logo_url, lt.owner_name,
               lt.owner_user_id, p.display_name
        into v_league_team_name, v_league_team_short_name, v_league_team_logo_url,
             v_league_team_owner_name, v_owner_user_id, v_owner_display_name
        from public.league_teams lt
        left join public.profiles p on p.id = lt.owner_user_id
        where lt.id = v_league_team_id;

        update public.teams
        set name       = v_league_team_name,
            short_name = v_league_team_short_name,
            logo_url   = v_league_team_logo_url,
            owner_name = coalesce(v_league_team_owner_name, v_owner_display_name)
        where id = v_draft_team.id;

        if v_owner_user_id is not null then
          update public.draft_participants
          set team_id = null
          where draft_id = v_draft.id and team_id = v_draft_team.id;

          insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
          values (v_draft.id, v_owner_user_id, v_draft_team.id, coalesce(v_league_team_owner_name, v_owner_display_name, 'Owner'), 'owner')
          on conflict (draft_id, user_id) do update set team_id = excluded.team_id;
        end if;

        insert into public.league_team_seasons (
          league_season_id, league_team_id, owner_user_id, draft_position, draft_team_id
        ) values (
          v_season.id, v_league_team_id, v_owner_user_id, v_draft_team.draft_position, v_draft_team.id
        )
        on conflict (league_season_id, league_team_id) do update
          set owner_user_id  = excluded.owner_user_id,
              draft_position = excluded.draft_position,
              draft_team_id  = excluded.draft_team_id;
      end if;
    end loop;
  end if;

  return v_season;
end;
$$;

revoke all on function public.create_draft_for_season(uuid, text, integer, integer, text) from public, anon;
grant execute on function public.create_draft_for_season(uuid, text, integer, integer, text) to authenticated;

-- ── 3. reset_season_draft ────────────────────────────────────────────────────

create or replace function public.reset_season_draft(p_season_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.league_seasons%rowtype;
begin
  select * into v_season
  from public.league_seasons
  where id = p_season_id;

  if v_season.id is null then
    raise exception using errcode = '22023', message = 'Season not found.';
  end if;

  if not public.is_league_commissioner(v_season.league_id) then
    raise exception using errcode = '42501', message = 'Only the commissioner can reset the draft.';
  end if;

  if v_season.draft_id is null then
    return; -- nothing to do
  end if;

  -- Deleting the draft cascades to teams, picks, participants.
  -- league_seasons.draft_id and league_team_seasons.draft_team_id both ON DELETE SET NULL.
  delete from public.drafts where id = v_season.draft_id;
end;
$$;

revoke all on function public.reset_season_draft(uuid) from public, anon;
grant execute on function public.reset_season_draft(uuid) to authenticated;
