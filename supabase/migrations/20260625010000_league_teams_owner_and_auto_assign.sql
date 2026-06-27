-- League Teams: add owner_user_id and auto-assign draft participants from franchise assignments

-- 1. Franchise owner field
alter table public.league_teams
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

-- 2. RPC: assign_league_team_owner
--    Sets the franchise owner on league_teams.
--    If the current season has a setup-phase draft, also syncs the participant
--    assignment in draft_participants and league_team_seasons.
create or replace function public.assign_league_team_owner(
  p_league_id uuid,
  p_league_team_id uuid,
  p_user_id uuid  -- null = remove owner
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_draft_id uuid;
  v_draft_team_id uuid;
  v_display_name text;
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can assign team owners.';
  end if;

  if not exists (
    select 1 from public.league_teams
    where id = p_league_team_id and league_id = p_league_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Team does not belong to this league.';
  end if;

  -- Update the franchise owner
  update public.league_teams
  set owner_user_id = p_user_id
  where id = p_league_team_id;

  if p_user_id is null then
    -- Removing owner: also clear any draft participant assignment for setup-phase drafts
    select ls.id, ls.draft_id, lts.draft_team_id
    into v_season_id, v_draft_id, v_draft_team_id
    from public.league_seasons ls
    join public.league_team_seasons lts
      on lts.league_season_id = ls.id and lts.league_team_id = p_league_team_id
    join public.drafts d on d.id = ls.draft_id and d.status = 'setup'
    where ls.league_id = p_league_id
    order by ls.year desc
    limit 1;

    if v_draft_team_id is not null then
      update public.draft_participants
      set team_id = null
      where draft_id = v_draft_id and team_id = v_draft_team_id;
    end if;

    if v_season_id is not null then
      update public.league_team_seasons
      set owner_user_id = null
      where league_season_id = v_season_id and league_team_id = p_league_team_id;
    end if;

    return;
  end if;

  -- Find the most recent season with a setup-phase draft
  select ls.id, ls.draft_id, lts.draft_team_id
  into v_season_id, v_draft_id, v_draft_team_id
  from public.league_seasons ls
  join public.league_team_seasons lts
    on lts.league_season_id = ls.id and lts.league_team_id = p_league_team_id
  join public.drafts d on d.id = ls.draft_id and d.status = 'setup'
  where ls.league_id = p_league_id
  order by ls.year desc
  limit 1;

  if v_draft_id is null or v_draft_team_id is null then
    -- No active setup draft — just saving the franchise assignment for future seasons
    return;
  end if;

  -- Get display name from profiles
  select display_name into v_display_name
  from public.profiles
  where id = p_user_id;

  -- Clear any existing team assignment for this draft team slot
  update public.draft_participants
  set team_id = null
  where draft_id = v_draft_id and team_id = v_draft_team_id;

  -- Upsert participant with draft team assignment
  insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
  values (v_draft_id, p_user_id, v_draft_team_id, coalesce(v_display_name, 'Owner'), 'owner')
  on conflict (draft_id, user_id) do update
    set team_id = excluded.team_id;

  -- Sync league_team_seasons.owner_user_id
  update public.league_team_seasons
  set owner_user_id = p_user_id
  where league_season_id = v_season_id and league_team_id = p_league_team_id;
end;
$$;

revoke all on function public.assign_league_team_owner(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.assign_league_team_owner(uuid, uuid, uuid)
to authenticated;

-- 3. Update materialize_league_season to carry over franchise names and pre-assigned owners
--    When league teams have owner_user_id set, those assignments are pushed into
--    draft_participants automatically on season creation.
create or replace function public.materialize_league_season(
  p_league_id uuid,
  p_year integer,
  p_name text,
  p_draft_id uuid
)
returns public.league_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.league_seasons%rowtype;
  v_draft public.drafts%rowtype;
  v_draft_team public.teams%rowtype;
  v_league_team_id uuid;
  v_league_team_name text;
  v_league_team_count integer;
  v_previous_season_id uuid;
  v_owner_user_id uuid;
  v_owner_display_name text;
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can create a season.';
  end if;

  if p_year is null or p_year not between 2000 and 2100 then
    raise exception using
      errcode = '22023',
      message = 'Season year must be between 2000 and 2100.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'Season name must be between 1 and 100 characters.';
  end if;

  select * into v_draft
  from public.drafts
  where id = p_draft_id
    and league_id = p_league_id
    and commissioner_user_id = auth.uid();

  if v_draft.id is null then
    raise exception using
      errcode = '42501',
      message = 'The draft is not managed by this league commissioner.';
  end if;

  insert into public.league_seasons (league_id, year, name, draft_id)
  values (p_league_id, p_year, trim(p_name), p_draft_id)
  returning * into v_season;

  select count(*)::integer into v_league_team_count
  from public.league_teams
  where league_id = p_league_id;

  select id into v_previous_season_id
  from public.league_seasons
  where league_id = p_league_id
    and id <> v_season.id
  order by year desc
  limit 1;

  if v_league_team_count not in (0, v_draft.team_count) then
    raise exception using
      errcode = '22023',
      message = 'League franchise count must match the draft team count.';
  end if;

  for v_draft_team in
    select * from public.teams
    where draft_id = p_draft_id
    order by draft_position
  loop
    if v_league_team_count = 0 then
      -- First season: create franchise teams from draft team names
      insert into public.league_teams (league_id, name, logo_url)
      values (p_league_id, v_draft_team.name, v_draft_team.logo_url)
      returning id into v_league_team_id;

      v_owner_user_id := null;
    else
      -- Find matching franchise from previous season or fall back to position order
      select league_team_id into v_league_team_id
      from public.league_team_seasons
      where league_season_id = v_previous_season_id
        and draft_position = v_draft_team.draft_position;

      if v_league_team_id is null then
        select id into v_league_team_id
        from public.league_teams
        where league_id = p_league_id
        order by created_at, id
        offset v_draft_team.draft_position - 1
        limit 1;
      end if;

      -- Read franchise name and pre-assigned owner
      select lt.name, lt.owner_user_id, p.display_name
      into v_league_team_name, v_owner_user_id, v_owner_display_name
      from public.league_teams lt
      left join public.profiles p on p.id = lt.owner_user_id
      where lt.id = v_league_team_id;

      -- Carry franchise name into the draft team slot
      update public.teams
      set name = v_league_team_name
      where id = v_draft_team.id;

      if v_owner_user_id is not null then
        -- Auto-assign the franchise owner as a draft participant
        update public.draft_participants
        set team_id = null
        where draft_id = p_draft_id and team_id = v_draft_team.id;

        insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
        values (p_draft_id, v_owner_user_id, v_draft_team.id, coalesce(v_owner_display_name, 'Owner'), 'owner')
        on conflict (draft_id, user_id) do update
          set team_id = excluded.team_id;
      else
        -- No pre-assigned owner: read from existing draft_participants
        select user_id into v_owner_user_id
        from public.draft_participants
        where draft_id = p_draft_id and team_id = v_draft_team.id;
      end if;
    end if;

    insert into public.league_team_seasons (
      league_season_id,
      league_team_id,
      owner_user_id,
      draft_position,
      draft_team_id
    ) values (
      v_season.id,
      v_league_team_id,
      v_owner_user_id,
      v_draft_team.draft_position,
      v_draft_team.id
    );
  end loop;

  return v_season;
end;
$$;
