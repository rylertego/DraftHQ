alter table public.leagues
  add column if not exists sleeper_league_id text,
  add column if not exists sleeper_last_synced_at timestamptz;

alter table public.leagues
  drop constraint if exists leagues_sleeper_league_id_check;
alter table public.leagues
  add constraint leagues_sleeper_league_id_check
  check (sleeper_league_id is null or sleeper_league_id ~ '^[0-9]{5,30}$');

alter table public.league_seasons
  add column if not exists sleeper_league_id text,
  add column if not exists champion_team_id uuid references public.league_teams(id) on delete set null,
  add column if not exists sleeper_synced_at timestamptz;

alter table public.league_seasons
  drop constraint if exists league_seasons_sleeper_league_id_check;
alter table public.league_seasons
  add constraint league_seasons_sleeper_league_id_check
  check (sleeper_league_id is null or sleeper_league_id ~ '^[0-9]{5,30}$');

create table if not exists public.league_season_standings (
  league_season_id uuid not null references public.league_seasons(id) on delete cascade,
  league_team_id uuid not null references public.league_teams(id) on delete cascade,
  sleeper_roster_id integer not null,
  final_rank integer not null check (final_rank between 1 and 32),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  ties integer not null default 0 check (ties >= 0),
  points_for numeric(12,2) not null default 0,
  points_against numeric(12,2) not null default 0,
  playoff_finish integer check (playoff_finish between 1 and 32),
  updated_at timestamptz not null default now(),
  primary key (league_season_id, league_team_id),
  unique (league_season_id, sleeper_roster_id)
);

alter table public.league_season_standings enable row level security;

drop policy if exists "Members can view league season standings" on public.league_season_standings;
create policy "Members can view league season standings"
on public.league_season_standings for select to authenticated
using (public.is_league_member(public.league_id_for_season(league_season_id)));

revoke all on public.league_season_standings from public, anon, authenticated;
grant select on public.league_season_standings to authenticated;

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
    v_team_id := (v_row->>'leagueTeamId')::uuid;
    if not exists (select 1 from public.league_teams where id = v_team_id and league_id = p_league_id) then
      raise exception using errcode = '22023', message = 'A standings team does not belong to this league.';
    end if;
    insert into public.league_season_standings (
      league_season_id, league_team_id, sleeper_roster_id, final_rank,
      wins, losses, ties, points_for, points_against, playoff_finish
    ) values (
      v_season.id, v_team_id, (v_row->>'sleeperRosterId')::integer, (v_row->>'finalRank')::integer,
      coalesce((v_row->>'wins')::integer, 0), coalesce((v_row->>'losses')::integer, 0),
      coalesce((v_row->>'ties')::integer, 0), coalesce((v_row->>'pointsFor')::numeric, 0),
      coalesce((v_row->>'pointsAgainst')::numeric, 0), nullif(v_row->>'playoffFinish', '')::integer
    );
  end loop;

  update public.leagues set
    sleeper_league_id = p_current_sleeper_league_id,
    sleeper_last_synced_at = now()
  where id = p_league_id;

  return v_season;
end;
$$;

revoke all on function public.sync_sleeper_league_history(uuid, text, integer, text, jsonb, uuid)
  from public, anon;
grant execute on function public.sync_sleeper_league_history(uuid, text, integer, text, jsonb, uuid)
  to authenticated;
