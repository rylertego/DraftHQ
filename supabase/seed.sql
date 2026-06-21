-- Deterministic local test data loaded after migrations by `supabase db reset`.
-- Authentication identities are created by individual test suites so each test
-- controls its own JWT claims and cleanup.

insert into public.players (
  id,
  source,
  external_id,
  full_name,
  position,
  nfl_team,
  active
)
select
  md5('drafthq-test-player-' || player_number::text)::uuid,
  'test',
  'test-player-' || lpad(player_number::text, 3, '0'),
  'Test Player ' || lpad(player_number::text, 3, '0'),
  (array['QB', 'RB', 'WR', 'TE', 'K', 'DST'])[
    ((player_number - 1) % 6) + 1
  ],
  'TST',
  true
from generate_series(1, 600) as seeded_players(player_number)
on conflict (source, external_id)
do update set
  full_name = excluded.full_name,
  position = excluded.position,
  nfl_team = excluded.nfl_team,
  active = excluded.active;
