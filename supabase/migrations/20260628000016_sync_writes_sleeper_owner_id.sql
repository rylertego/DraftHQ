-- Replace RPC: also persist sleeper_owner_id on league_teams so future
-- syncs match by stable Sleeper user ID rather than fuzzy team name.

create or replace function public.sync_sleeper_league_history(
  p_league_id uuid,
  p_current_sleeper_league_id text,
  p_season_year integer,
  p_season_sleeper_league_id text,
  p_standings jsonb,
  p_champion_team_id uuid default null
)
returns public.league_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.league_seasons%rowtype;
  v_row jsonb;
  v_team_id uuid;
  v_wins integer;
  v_losses integer;
  v_ties integer;
  v_playoff_finish integer;
  v_record varchar(20);
  v_owner_id text;
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using errcode = '42501', message = 'Only a league commissioner can sync Sleeper history.';
  end if;
  if p_current_sleeper_league_id !~ '^[0-9]{5,30}$'
    or p_season_sleeper_league_id !~ '^[0-9]{5,30}$'
    or p_season_year not between 2000 and 2100
    or jsonb_typeof(p_standings) <> 'array'
  then
    raise exception using errcode = '22023', message = 'Sleeper sync data is invalid.';
  end if;
  if p_champion_team_id is not null and not exists (
    select 1 from public.league_teams where id = p_champion_team_id and league_id = p_league_id
  ) then
    raise exception using errcode = '22023', message = 'Champion team does not belong to this league.';
  end if;

  insert into public.league_seasons (league_id, year, name, status, sleeper_league_id, champion_team_id, sleeper_synced_at)
  values (p_league_id, p_season_year, p_season_year || ' Season', 'complete', p_season_sleeper_league_id, p_champion_team_id, now())
  on conflict (league_id, year) do update set
    status = case
      when public.league_seasons.draft_id is null then 'complete'
      else public.league_seasons.status
    end,
    sleeper_league_id = excluded.sleeper_league_id,
    champion_team_id = excluded.champion_team_id,
    sleeper_synced_at = now()
  returning * into v_season;

  delete from public.league_season_standings where league_season_id = v_season.id;
  for v_row in select value from jsonb_array_elements(p_standings)
  loop
    v_team_id        := (v_row->>'leagueTeamId')::uuid;
    v_wins           := coalesce((v_row->>'wins')::integer, 0);
    v_losses         := coalesce((v_row->>'losses')::integer, 0);
    v_ties           := coalesce((v_row->>'ties')::integer, 0);
    v_playoff_finish := nullif(v_row->>'playoffFinish', '')::integer;
    v_owner_id       := nullif(trim(v_row->>'ownerId'), '');

    if not exists (select 1 from public.league_teams where id = v_team_id and league_id = p_league_id) then
      raise exception using errcode = '22023', message = 'A standings team does not belong to this league.';
    end if;

    insert into public.league_season_standings (
      league_season_id, league_team_id, sleeper_roster_id, final_rank,
      wins, losses, ties, points_for, points_against, playoff_finish
    ) values (
      v_season.id, v_team_id, (v_row->>'sleeperRosterId')::integer, (v_row->>'finalRank')::integer,
      v_wins, v_losses, v_ties,
      coalesce((v_row->>'pointsFor')::numeric, 0),
      coalesce((v_row->>'pointsAgainst')::numeric, 0),
      v_playoff_finish
    );

    v_record := v_wins || '-' || v_losses || case when v_ties > 0 then '-' || v_ties else '' end;
    update public.league_teams set
      sleeper_owner_id     = coalesce(v_owner_id, sleeper_owner_id),
      last_season_record   = v_record,
      last_season_playoffs = (v_playoff_finish is not null)
    where id = v_team_id;
  end loop;

  update public.leagues set
    sleeper_league_id      = p_current_sleeper_league_id,
    sleeper_last_synced_at = now()
  where id = p_league_id;

  return v_season;
end;
$$;

revoke all on function public.sync_sleeper_league_history(uuid, text, integer, text, jsonb, uuid)
  from public, anon;
grant execute on function public.sync_sleeper_league_history(uuid, text, integer, text, jsonb, uuid)
  to authenticated;
