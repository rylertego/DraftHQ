-- API routes use supabaseAdmin (service_role) to check commissioner status
-- and manage league members. The league identity migration revoked all
-- service_role table privileges, so re-grant only what the API routes need.

grant select on public.leagues to service_role;
grant select, insert, delete on public.league_members to service_role;
