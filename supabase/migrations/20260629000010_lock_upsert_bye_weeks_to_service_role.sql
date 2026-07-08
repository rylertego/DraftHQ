-- C3: upsert_bye_weeks must only be callable by server-side code.
-- Granting it to authenticated lets any logged-in user overwrite bye-week data.
revoke execute on function public.upsert_bye_weeks(integer, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_bye_weeks(integer, jsonb) to service_role;
