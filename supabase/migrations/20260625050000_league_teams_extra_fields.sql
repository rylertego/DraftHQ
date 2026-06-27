-- Extra franchise-level fields on league_teams
-- Mirror the per-team fields from draft settings (minus TTS, autodraft, pre-draft notes, walk-up songs).

alter table public.league_teams
  add column if not exists short_name           varchar(10)  default null,
  add column if not exists owner_name           varchar(100) default null,
  add column if not exists last_season_pick     integer      default null check (last_season_pick between 1 and 50),
  add column if not exists last_season_record   varchar(20)  default null,
  add column if not exists last_season_playoffs boolean      default null;
