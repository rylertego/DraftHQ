-- Server routes use service-role credentials after authenticating and
-- authorizing the caller. Keep these privileges limited to their current data
-- requirements on a clean schema; browser clients continue to use read policies
-- and RPC writes. Existing hosted grants must be audited separately because a
-- grant migration does not revoke privileges already present there.
grant select
on public.drafts, public.teams, public.draft_participants
to service_role;

grant select, insert, update
on public.draft_invitations
to service_role;
