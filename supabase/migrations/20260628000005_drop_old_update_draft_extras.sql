-- Drop the two old overloads of update_draft_extras so Postgres stops
-- complaining about ambiguous function resolution. The 15-param version
-- (added in 20260628000001) already has all params defaulting to null,
-- so every existing caller works without any client changes.

drop function if exists public.update_draft_extras(uuid, text, boolean, integer, boolean, timestamptz, text, jsonb);
drop function if exists public.update_draft_extras(uuid, text, boolean, integer, boolean, timestamptz, text, jsonb, integer, text, integer);
