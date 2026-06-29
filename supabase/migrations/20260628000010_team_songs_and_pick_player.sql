-- Add last_season_pick_player (player name, replaces the old pick number in UI)
-- and walk_up_songs (JSONB array for music integration) to draft teams.

alter table public.teams
  add column if not exists last_season_pick_player text,
  add column if not exists walk_up_songs           jsonb not null default '[]'::jsonb;

-- Extend update_team_details to include the new fields and fix autodraft
-- player selection to use rank ordering instead of alphabetical.

create or replace function public.update_team_details(
  p_draft_id            uuid,
  p_team_id             uuid,
  p_name                text        default null,
  p_short_name          text        default null,
  p_tts_name            text        default null,
  p_autodraft           boolean     default null,
  p_pre_draft_notes     text        default null,
  p_last_season_pick    integer     default null,
  p_last_season_record  text        default null,
  p_last_season_playoffs boolean    default null,
  p_owner_name          text        default null,
  p_last_season_pick_player text    default null,
  p_walk_up_songs       jsonb       default null
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft   public.drafts%rowtype;
  v_team    public.teams%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;

  select * into v_team from public.teams where id = p_team_id and draft_id = p_draft_id;
  if not found then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

  -- Commissioner can edit any team; owner can only edit their own.
  if v_draft.commissioner_user_id <> v_user_id then
    if v_team.owner_user_id is null or v_team.owner_user_id <> v_user_id then
      raise exception 'Not authorized to edit this team.' using errcode = '42501';
    end if;
  end if;

  update public.teams set
    name                     = coalesce(p_name,                   name),
    short_name               = coalesce(p_short_name,             short_name),
    tts_name                 = coalesce(p_tts_name,               tts_name),
    autodraft                = coalesce(p_autodraft,              autodraft),
    pre_draft_notes          = coalesce(p_pre_draft_notes,        pre_draft_notes),
    last_season_pick         = coalesce(p_last_season_pick,       last_season_pick),
    last_season_record       = coalesce(p_last_season_record,     last_season_record),
    last_season_playoffs     = coalesce(p_last_season_playoffs,   last_season_playoffs),
    owner_name               = coalesce(p_owner_name,             owner_name),
    last_season_pick_player  = coalesce(p_last_season_pick_player, last_season_pick_player),
    walk_up_songs            = coalesce(p_walk_up_songs,          walk_up_songs)
  where id = p_team_id
  returning * into v_team;

  return v_team;
end;
$$;

revoke all on function public.update_team_details(uuid, uuid, text, text, text, boolean, text, integer, text, boolean, text, text, jsonb) from public, anon;
grant execute on function public.update_team_details(uuid, uuid, text, text, text, boolean, text, integer, text, boolean, text, text, jsonb) to authenticated;

-- Fix autodraft pick selection to use rankings order instead of alphabetical.
-- Recreates expire_current_pick with rank-first ordering.
create or replace function public.expire_current_pick(
  p_draft_id     uuid,
  p_expected_pick integer
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft        public.drafts%rowtype;
  v_total_picks  integer;
  v_round        integer;
  v_pick_number  integer;
  v_draft_position integer;
  v_team         public.teams%rowtype;
  v_participant  public.draft_participants%rowtype;
  v_player_id    uuid;
  v_pick         public.picks%rowtype;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_draft.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'Draft is not active.';
  end if;

  if v_draft.current_pick <> p_expected_pick then
    return v_draft;
  end if;

  if v_draft.pick_seconds > 0 and v_draft.pick_deadline_at > now() then
    return v_draft;
  end if;

  if v_draft.timer_behavior = 'nothing' or v_draft.pick_seconds = 0 then
    return v_draft;
  end if;

  v_total_picks := v_draft.team_count * v_draft.rounds;

  v_round := ceil(v_draft.current_pick::numeric / v_draft.team_count);
  v_pick_number := v_draft.current_pick - (v_round - 1) * v_draft.team_count;

  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team
  from public.teams
  where draft_id = p_draft_id and draft_position = v_draft_position;

  select * into v_participant
  from public.draft_participants
  where draft_id = p_draft_id
    and user_id = v_draft.commissioner_user_id;

  if v_draft.timer_behavior = 'auto_draft' then
    -- Pick best available by rank, then alphabetical as tiebreaker.
    select p.id into v_player_id
    from public.players p
    where p.active = true
      and not exists (
        select 1 from public.picks pk
        where pk.draft_id = p_draft_id and pk.player_id = p.id
      )
    order by p.rank asc nulls last, p.full_name
    limit 1;

    if v_player_id is null then
      raise exception using errcode = 'P0002', message = 'No available players to auto-draft.';
    end if;

    insert into public.picks (
      draft_id, team_id, player_id, participant_id,
      round, pick_number, overall_pick_number
    ) values (
      p_draft_id, v_team.id, v_player_id, v_participant.id,
      v_round, v_pick_number, v_draft.current_pick
    ) returning * into v_pick;
  end if;

  update public.drafts set
    current_pick             = v_draft.current_pick + 1,
    status                   = case
      when v_draft.current_pick = v_total_picks then 'complete'
      else 'active'
    end,
    pick_deadline_at         = case
      when v_draft.current_pick = v_total_picks then null
      else now() + make_interval(secs => pick_seconds)
    end,
    clock_extensions_used    = 0,
    paused_remaining_seconds = null
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;
