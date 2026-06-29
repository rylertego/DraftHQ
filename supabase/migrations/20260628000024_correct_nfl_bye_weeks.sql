-- Correct 2025 seed data and add 2026 bye weeks. Derived from the nflverse
-- regular-season schedule release:
-- https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv

insert into public.nfl_bye_weeks (season_year, nfl_team, bye_week) values
  (2025, 'ARI', 8),  (2025, 'ATL', 5),  (2025, 'BAL', 7),  (2025, 'BUF', 7),
  (2025, 'CAR', 14), (2025, 'CHI', 5),  (2025, 'CIN', 10), (2025, 'CLE', 9),
  (2025, 'DAL', 10), (2025, 'DEN', 12), (2025, 'DET', 8),  (2025, 'GB', 5),
  (2025, 'HOU', 6),  (2025, 'IND', 11), (2025, 'JAX', 8),  (2025, 'KC', 10),
  (2025, 'LAR', 8),  (2025, 'LAC', 12), (2025, 'LV', 8),   (2025, 'MIA', 12),
  (2025, 'MIN', 6),  (2025, 'NE', 14),  (2025, 'NO', 11),  (2025, 'NYG', 14),
  (2025, 'NYJ', 9),  (2025, 'PHI', 9),  (2025, 'PIT', 5),   (2025, 'SEA', 8),
  (2025, 'SF', 14),  (2025, 'TB', 9),   (2025, 'TEN', 10),  (2025, 'WAS', 12),
  (2026, 'ARI', 14), (2026, 'ATL', 11), (2026, 'BAL', 13),  (2026, 'BUF', 7),
  (2026, 'CAR', 5),  (2026, 'CHI', 10), (2026, 'CIN', 6),   (2026, 'CLE', 11),
  (2026, 'DAL', 14), (2026, 'DEN', 10), (2026, 'DET', 6),   (2026, 'GB', 11),
  (2026, 'HOU', 8),  (2026, 'IND', 13), (2026, 'JAX', 7),   (2026, 'KC', 5),
  (2026, 'LAR', 11), (2026, 'LAC', 7),  (2026, 'LV', 13),   (2026, 'MIA', 6),
  (2026, 'MIN', 6),  (2026, 'NE', 11),  (2026, 'NO', 8),    (2026, 'NYG', 8),
  (2026, 'NYJ', 13), (2026, 'PHI', 10), (2026, 'PIT', 9),   (2026, 'SEA', 11),
  (2026, 'SF', 8),   (2026, 'TB', 10),  (2026, 'TEN', 9),   (2026, 'WAS', 7)
on conflict (season_year, nfl_team)
do update set
  bye_week = excluded.bye_week,
  updated_at = now();
