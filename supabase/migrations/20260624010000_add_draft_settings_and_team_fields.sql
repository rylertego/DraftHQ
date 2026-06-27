-- ── Draft settings columns ─────────────────────────────────────────────────────
-- These power the draft settings page: schedule, roster positions, scoring type,
-- landmines (formerly whammies), and hidden player rankings.

alter table public.drafts
  add column if not exists scheduled_at        timestamptz,
  add column if not exists scheduled_timezone  text,
  add column if not exists roster_positions    jsonb,
  add column if not exists scoring_type        text not null default 'standard'
    check (scoring_type in ('standard', 'ppr', 'half_ppr', 'superflex')),
  add column if not exists use_landmines       boolean not null default false,
  add column if not exists landmine_count      integer not null default 3
    check (landmine_count between 1 and 30),
  add column if not exists hide_player_rankings boolean not null default false;

-- ── Teams extended fields ──────────────────────────────────────────────────────
-- Power the team accordion in setup: short name, TTS, autodraft, notes,
-- last-season info. Owner name/photo come later with Storage.

alter table public.teams
  add column if not exists short_name          text check (char_length(trim(short_name)) <= 10),
  add column if not exists tts_name            text check (char_length(trim(tts_name)) <= 60),
  add column if not exists autodraft           boolean not null default false,
  add column if not exists pre_draft_notes     text check (char_length(trim(pre_draft_notes)) <= 2000),
  add column if not exists last_season_pick    integer check (last_season_pick between 1 and 20),
  add column if not exists last_season_record  text check (char_length(trim(last_season_record)) <= 20),
  add column if not exists last_season_playoffs boolean,
  add column if not exists owner_name          text check (char_length(trim(owner_name)) <= 100),
  add column if not exists owner_photo_url     text;

-- ── update_team_setup: extend to accept new fields ────────────────────────────
-- The existing function only handles name + draft_position (ordering).
-- We extend update_draft_extras for draft fields and add update_team_details
-- for the per-team accordion fields.

create or replace function public.update_draft_extras(
  p_draft_id        uuid,
  p_scoring_type    text    default null,
  p_use_landmines   boolean default null,
  p_landmine_count  integer default null,
  p_hide_rankings   boolean default null,
  p_scheduled_at    timestamptz default null,
  p_scheduled_tz    text    default null,
  p_roster_positions jsonb  default null
)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;
  if v_draft.commissioner_user_id <> auth.uid() then
    raise exception 'Only the commissioner can update draft settings.' using errcode = '42501';
  end if;

  update public.drafts set
    scoring_type        = coalesce(p_scoring_type,    scoring_type),
    use_landmines       = coalesce(p_use_landmines,   use_landmines),
    landmine_count      = coalesce(p_landmine_count,  landmine_count),
    hide_player_rankings = coalesce(p_hide_rankings,  hide_player_rankings),
    scheduled_at        = case when p_scheduled_at is not null or p_scheduled_tz is not null
                               then p_scheduled_at else scheduled_at end,
    scheduled_timezone  = coalesce(p_scheduled_tz,   scheduled_timezone),
    roster_positions    = coalesce(p_roster_positions, roster_positions),
    updated_at          = now()
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

revoke all on function public.update_draft_extras(uuid, text, boolean, integer, boolean, timestamptz, text, jsonb) from public, anon;
grant execute on function public.update_draft_extras(uuid, text, boolean, integer, boolean, timestamptz, text, jsonb) to authenticated;

-- ── update_team_details RPC ────────────────────────────────────────────────────
-- Saves per-team accordion fields from the setup page.

create or replace function public.update_team_details(
  p_draft_id          uuid,
  p_team_id           uuid,
  p_short_name        text    default null,
  p_tts_name          text    default null,
  p_autodraft         boolean default null,
  p_pre_draft_notes   text    default null,
  p_last_season_pick  integer default null,
  p_last_season_record text   default null,
  p_last_season_playoffs boolean default null,
  p_owner_name        text    default null
)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
begin
  -- Commissioner check via draft
  if not exists (
    select 1 from public.drafts
    where id = p_draft_id and commissioner_user_id = auth.uid()
  ) then
    raise exception 'Only the draft commissioner can update team details.' using errcode = '42501';
  end if;

  update public.teams set
    short_name           = coalesce(p_short_name,          short_name),
    tts_name             = coalesce(p_tts_name,            tts_name),
    autodraft            = coalesce(p_autodraft,           autodraft),
    pre_draft_notes      = coalesce(p_pre_draft_notes,     pre_draft_notes),
    last_season_pick     = coalesce(p_last_season_pick,    last_season_pick),
    last_season_record   = coalesce(p_last_season_record,  last_season_record),
    last_season_playoffs = coalesce(p_last_season_playoffs, last_season_playoffs),
    owner_name           = coalesce(p_owner_name,          owner_name),
    updated_at           = now()
  where id = p_team_id and draft_id = p_draft_id
  returning * into v_team;

  if not found then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

  return v_team;
end;
$$;

revoke all on function public.update_team_details(uuid, uuid, text, text, boolean, text, integer, text, boolean, text) from public, anon;
grant execute on function public.update_team_details(uuid, uuid, text, text, boolean, text, integer, text, boolean, text) to authenticated;

-- ── Clear scheduled_at when explicitly set to null ─────────────────────────────
-- Add a dedicated function to clear the draft schedule, since coalesce() above
-- can't distinguish "don't change" from "set to null".

create or replace function public.clear_draft_schedule(p_draft_id uuid)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
begin
  update public.drafts
  set scheduled_at = null, scheduled_timezone = null, updated_at = now()
  where id = p_draft_id
    and commissioner_user_id = auth.uid()
  returning * into v_draft;

  if not found then
    raise exception 'Draft not found or not authorized.' using errcode = 'P0002';
  end if;

  return v_draft;
end;
$$;

revoke all on function public.clear_draft_schedule(uuid) from public, anon;
grant execute on function public.clear_draft_schedule(uuid) to authenticated;
