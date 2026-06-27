-- Carry all franchise fields (short_name, logo_url, owner_name) into draft
-- team slots during season materialization, not just the team name.

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
  v_league_team_short_name text;
  v_league_team_logo_url text;
  v_league_team_owner_name text;
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

  if v_league_team_count > v_draft.team_count then
    raise exception using
      errcode = '22023',
      message = 'Active franchise count (' || v_league_team_count || ') exceeds draft team count (' || v_draft.team_count || ').';
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

      insert into public.league_team_seasons (
        league_season_id, league_team_id, owner_user_id, draft_position, draft_team_id
      ) values (
        v_season.id, v_league_team_id, v_owner_user_id, v_draft_team.draft_position, v_draft_team.id
      );
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

      -- Only populate slots that have a matched franchise; leave the rest as defaults
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
          where draft_id = p_draft_id and team_id = v_draft_team.id;

          insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
          values (p_draft_id, v_owner_user_id, v_draft_team.id, coalesce(v_league_team_owner_name, v_owner_display_name, 'Owner'), 'owner')
          on conflict (draft_id, user_id) do update
            set team_id = excluded.team_id;
        else
          select user_id into v_owner_user_id
          from public.draft_participants
          where draft_id = p_draft_id and team_id = v_draft_team.id;
        end if;

        insert into public.league_team_seasons (
          league_season_id, league_team_id, owner_user_id, draft_position, draft_team_id
        ) values (
          v_season.id, v_league_team_id, v_owner_user_id, v_draft_team.draft_position, v_draft_team.id
        );
      end if; -- v_league_team_id is not null
    end if;
  end loop;

  return v_season;
end;
$$;
