-- Add overall ranking/ADP field to players.
-- Populated manually, via CSV import, or from a rankings provider (Sleeper ADP, FantasyPros, etc.).
-- NULL = unranked; ranked players sort before unranked ones.

alter table public.players
  add column if not exists rank integer;

create index if not exists players_rank_idx
  on public.players (rank nulls last);
