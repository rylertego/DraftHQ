-- Draft-grading inputs: market ADP and projected season points.
--
-- Both come from the same ESPN payload the rankings sync already fetches:
--   ownership.averageDraftPosition           -> adp
--   stats[id = "10{year}", statSourceId = 1,
--         statSplitTypeId = 0].appliedTotal  -> projected_points
--
-- Nullable on purpose. ESPN flattens ADP to a constant once a season is over,
-- and projections are absent for some players; the grader treats a null as
-- "market value could not be evaluated" rather than a zero.

alter table public.espn_rankings
  add column if not exists adp              numeric,
  add column if not exists projected_points numeric;
