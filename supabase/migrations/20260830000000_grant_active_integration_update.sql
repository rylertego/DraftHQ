-- Provider import records the selected league connection after inserting teams.
-- The update policy already restricts this to commissioners; this grant exposes
-- the column to authenticated clients so the policy can actually run.
grant update (active_integration) on public.leagues to authenticated;
