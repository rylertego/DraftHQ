-- ESPN fantasy rankings cache
-- Fetched daily per scoring type and season year

create table if not exists public.espn_rankings (
  season_year   integer not null,
  scoring_type  text    not null check (scoring_type in ('standard', 'ppr', 'half_ppr', 'superflex')),
  espn_player_id integer not null,
  player_name   text    not null,
  nfl_team      text,
  position      text,
  rank          integer not null,
  fetched_at    timestamptz not null default now(),
  primary key (season_year, scoring_type, espn_player_id)
);

-- Any authenticated user can read rankings
alter table public.espn_rankings enable row level security;

drop policy if exists "rankings_read" on public.espn_rankings;
create policy "rankings_read" on public.espn_rankings
  for select using (true);

-- Service role writes (API route uses supabaseAdmin)
create index if not exists espn_rankings_lookup_idx
  on public.espn_rankings (season_year, scoring_type, rank);
