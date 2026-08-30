-- Drop the stale overloads of configure_draft_timer and update_team_details,
-- the same ambiguity 20260628000005 cleared for update_draft_extras.
--
-- Both surviving versions default every param past the required ones, so a
-- call passing only the shared subset matched both candidates and failed with
-- "function ... is not unique" (42725) rather than picking one. Current callers
-- in draftApi.ts pass the full argument set, so they already resolve to the
-- versions kept here and need no client changes.
--
-- Kept: configure_draft_timer(uuid, integer, text, integer, integer)  [20260821050553]
-- Kept: update_team_details(uuid, uuid, text, text, text, boolean, text,
--                           integer, text, boolean, text, text, jsonb) [20260821050553]

drop function if exists public.configure_draft_timer(uuid, integer);
drop function if exists public.update_team_details(uuid, uuid, text, text, boolean, text, integer, text, boolean, text);
