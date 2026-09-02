-- A skipped pick advances current_pick without writing a picks row, which left
-- two commissioner tools dead on those slots.
--
-- 1. commissioner_edit_pick required an existing row and only ever UPDATEd, so
--    filling in a pick that was made verbally after the skip raised "Pick slot
--    not found."
--
-- 2. undo_pick asserts the newest pick sits at current_pick - 1. After a skip
--    nothing sits there, so it raised "Draft pick state is inconsistent." and
--    the skip could never be rolled back.

-- A stale 3-argument commissioner_edit_pick still existed alongside the
-- 4-argument version. Only the latter gets replaced below, so leaving the old
-- one in place would keep skip-blind code reachable, and any caller passing
-- three arguments is ambiguous between them (42725). The app always sends
-- p_new_team_id, so nothing depends on the short signature.
drop function if exists public.commissioner_edit_pick(uuid, integer, uuid);

-- ── Fill or edit a slot, including one that was skipped ─────────────────────
create or replace function public.commissioner_edit_pick(
  p_draft_id uuid,
  p_overall_pick_number integer,
  p_new_player_id uuid,
  p_new_team_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft          public.drafts%rowtype;
  v_total_picks    integer;
  v_round          integer;
  v_pick_number    integer;
  v_draft_position integer;
  v_team_id        uuid;
  v_participant_id uuid;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if auth.uid() is null or v_draft.commissioner_user_id <> auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can edit picks.';
  end if;

  if exists (
    select 1 from public.picks
    where draft_id = p_draft_id
      and player_id = p_new_player_id
      and overall_pick_number <> p_overall_pick_number
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'That player has already been drafted by another team.';
  end if;

  if p_new_team_id is not null and not exists (
    select 1 from public.teams
    where id = p_new_team_id and draft_id = p_draft_id
  ) then
    raise exception using errcode = 'P0002', message = 'Team not found in this draft.';
  end if;

  if exists (
    select 1 from public.picks
    where draft_id = p_draft_id
      and overall_pick_number = p_overall_pick_number
  ) then
    update public.picks
    set
      player_id = p_new_player_id,
      team_id   = coalesce(p_new_team_id, team_id)
    where draft_id = p_draft_id
      and overall_pick_number = p_overall_pick_number;
    return;
  end if;

  -- No row: this slot was skipped. Recreate it in place rather than refusing,
  -- so a pick agreed after the fact can be recorded where it belongs.
  v_total_picks := v_draft.team_count * v_draft.rounds;

  if p_overall_pick_number < 1 or p_overall_pick_number > v_total_picks then
    raise exception using errcode = 'P0002', message = 'Pick slot not found.';
  end if;

  -- Only a slot the draft has already passed can be filled. A future slot has
  -- not been skipped, it simply has not happened yet.
  if p_overall_pick_number >= v_draft.current_pick then
    raise exception using
      errcode = 'P0001',
      message = 'That pick has not happened yet.';
  end if;

  v_round := ((p_overall_pick_number - 1) / v_draft.team_count) + 1;
  v_pick_number := ((p_overall_pick_number - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  if p_new_team_id is not null then
    v_team_id := p_new_team_id;
  else
    select id into v_team_id
    from public.teams
    where draft_id = p_draft_id and draft_position = v_draft_position;
  end if;

  if v_team_id is null then
    raise exception using errcode = 'P0002', message = 'The team for that pick could not be found.';
  end if;

  -- Audit metadata only; picks.participant_id is nullable.
  select id into v_participant_id
  from public.draft_participants
  where draft_id = p_draft_id and team_id = v_team_id
  limit 1;

  insert into public.picks (
    draft_id, team_id, player_id, participant_id,
    round, pick_number, overall_pick_number
  ) values (
    p_draft_id, v_team_id, p_new_player_id, v_participant_id,
    v_round, v_pick_number, p_overall_pick_number
  );
end;
$$;

-- ── Undo the previous pick, or the previous skip ────────────────────────────
create or replace function public.undo_pick(p_draft_id uuid)
returns public.picks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
  v_pick  public.picks%rowtype;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if auth.uid() is null or v_draft.commissioner_user_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the commissioner can undo picks.';
  end if;

  if v_draft.current_pick <= 1 then
    raise exception using errcode = 'P0002', message = 'There are no picks to undo.';
  end if;

  -- Look at the slot the draft just left rather than the newest pick overall.
  -- A skipped slot has no row there, and that is the case the old lookup
  -- treated as corruption.
  select * into v_pick
  from public.picks
  where draft_id = p_draft_id
    and overall_pick_number = v_draft.current_pick - 1;

  if found then
    delete from public.picks where id = v_pick.id;
  end if;

  update public.drafts
  set
    current_pick = v_draft.current_pick - 1,
    status = case when v_draft.status = 'complete' then 'active' else v_draft.status end,
    pick_deadline_at = case
      when v_draft.status in ('active', 'complete')
        then now() + make_interval(secs => pick_seconds)
      else null
    end,
    paused_remaining_seconds = case
      when v_draft.status = 'paused' then pick_seconds
      else null
    end
  where id = p_draft_id;

  -- Null when a skip was rolled back: there was no pick to hand back.
  return v_pick;
end;
$$;
