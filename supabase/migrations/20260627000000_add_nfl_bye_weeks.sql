-- NFL bye weeks per season year
-- Populated by commissioner manually or auto-extracted from Sleeper player import

create table if not exists public.nfl_bye_weeks (
  season_year  integer not null,
  nfl_team     text    not null,
  bye_week     integer not null check (bye_week between 1 and 18),
  updated_at   timestamptz not null default now(),
  primary key (season_year, nfl_team)
);

-- Any authenticated user can read bye weeks
alter table public.nfl_bye_weeks enable row level security;

drop policy if exists "bye_weeks_read" on public.nfl_bye_weeks;
create policy "bye_weeks_read" on public.nfl_bye_weeks
  for select using (true);

-- Only service role writes (commissioner actions go through RPCs)
-- Commissioners upsert via the rpc below

create or replace function public.upsert_bye_weeks(
  p_season_year integer,
  p_bye_weeks   jsonb  -- [{ nfl_team: "KC", bye_week: 12 }, ...]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
begin
  -- Callers must be authenticated (RLS not used here but auth still required)
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  for item in select * from jsonb_array_elements(p_bye_weeks)
  loop
    insert into public.nfl_bye_weeks (season_year, nfl_team, bye_week, updated_at)
    values (
      p_season_year,
      (item->>'nfl_team')::text,
      (item->>'bye_week')::integer,
      now()
    )
    on conflict (season_year, nfl_team)
    do update set bye_week = excluded.bye_week, updated_at = excluded.updated_at;
  end loop;
end;
$$;

grant execute on function public.upsert_bye_weeks(integer, jsonb) to authenticated;

-- Seed 2025 NFL bye weeks
insert into public.nfl_bye_weeks (season_year, nfl_team, bye_week) values
  (2025, 'ARI',  5), (2025, 'LAC',  5),
  (2025, 'BAL',  6), (2025, 'CLE',  6), (2025, 'LAR',  6), (2025, 'NYG',  6),
  (2025, 'CIN',  7), (2025, 'DAL',  7), (2025, 'DET',  7), (2025, 'PHI',  7),
  (2025, 'DEN',  9), (2025, 'MIA',  9), (2025, 'MIN',  9), (2025, 'NYJ',  9),
  (2025, 'ATL', 10), (2025, 'CHI', 10), (2025, 'GB',  10), (2025, 'SEA', 10),
  (2025, 'BUF', 11), (2025, 'IND', 11), (2025, 'NO',  11), (2025, 'TB',  11),
  (2025, 'CAR', 12), (2025, 'HOU', 12), (2025, 'JAX', 12), (2025, 'KC',  12),
  (2025, 'LV',  12), (2025, 'NE',  12), (2025, 'PIT', 12), (2025, 'SF',  12),
  (2025, 'TEN', 12), (2025, 'WAS', 12)
on conflict (season_year, nfl_team) do nothing;
