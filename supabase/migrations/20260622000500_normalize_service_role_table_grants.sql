-- Supabase projects may inherit broad service_role table defaults. Normalize
-- existing application tables before restoring the exact server-route grants.
revoke all on public.drafts from service_role;
revoke all on public.teams from service_role;
revoke all on public.draft_participants from service_role;
revoke all on public.draft_invitations from service_role;
revoke all on public.picks from service_role;
revoke all on public.players from service_role;
revoke all on public.profiles from service_role;

grant select
on public.drafts, public.teams, public.draft_participants
to service_role;

grant select, insert, update
on public.draft_invitations
to service_role;
