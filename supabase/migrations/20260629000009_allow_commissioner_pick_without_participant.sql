-- League-linked drafts can outlive or replace their original participant row.
-- Commissioner authority is the drafts.commissioner_user_id field; a missing
-- participant must not prevent that commissioner from making a recovery pick.
create or replace function public.record_draft_pick(
  p_draft_id uuid,
  p_player_id uuid,
  p_commissioner_override boolean
)
returns public.picks
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_team public.teams%rowtype;
  v_participant public.draft_participants%rowtype;
  v_pick public.picks%rowtype;
  v_round integer;
  v_pick_number integer;
  v_draft_position integer;
  v_total_picks integer;
  v_is_landmine boolean;
begin
  select * into v_draft from public.drafts where id = p_draft_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication is required.';
  end if;
  if p_commissioner_override and v_draft.commissioner_user_id <> v_user_id then
    raise exception using errcode = '42501', message = 'Only the commissioner can make a recovery pick.';
  end if;
  if v_draft.status <> 'active' then
    raise exception using errcode = 'P0001', message = case v_draft.status
      when 'setup' then 'The draft has not started.'
      when 'paused' then 'The draft is paused.'
      else 'The draft is complete.'
    end;
  end if;

  v_total_picks := v_draft.team_count * v_draft.rounds;
  if v_draft.current_pick > v_total_picks then
    raise exception using errcode = 'P0001', message = 'The draft has no remaining picks.';
  end if;

  v_round := ((v_draft.current_pick - 1) / v_draft.team_count) + 1;
  v_pick_number := ((v_draft.current_pick - 1) % v_draft.team_count) + 1;
  v_draft_position := case
    when v_round % 2 = 1 then v_pick_number
    else v_draft.team_count - v_pick_number + 1
  end;

  select * into v_team from public.teams
  where draft_id = p_draft_id and draft_position = v_draft_position;
  if not found then
    raise exception using errcode = 'P0002', message = 'The team on the clock could not be found.';
  end if;

  if p_commissioner_override then
    -- This row is audit metadata only. Authorization already used the
    -- authoritative commissioner_user_id above, and picks.participant_id is nullable.
    select * into v_participant from public.draft_participants
    where draft_id = p_draft_id and user_id = v_user_id and role = 'commissioner';
  else
    select * into v_participant from public.draft_participants
    where draft_id = p_draft_id
      and user_id = v_user_id
      and team_id = v_team.id
      and role in ('commissioner', 'owner');
    if not found then
      raise exception using errcode = '42501', message = 'Only the team currently on the clock can make this pick.';
    end if;
  end if;

  if not exists (select 1 from public.players where id = p_player_id and active) then
    raise exception using errcode = 'P0002', message = 'Active player not found.';
  end if;
  if exists (select 1 from public.picks where draft_id = p_draft_id and player_id = p_player_id) then
    raise exception using errcode = '23505', message = 'That player has already been drafted.';
  end if;

  v_is_landmine := v_draft.use_landmines
    and array_length(v_draft.landmine_player_ids, 1) > 0
    and p_player_id = any(v_draft.landmine_player_ids);

  insert into public.picks (
    draft_id, team_id, player_id, participant_id,
    round, pick_number, overall_pick_number, is_landmine
  ) values (
    p_draft_id, v_team.id, p_player_id, v_participant.id,
    v_round, v_pick_number, v_draft.current_pick, v_is_landmine
  ) returning * into v_pick;

  update public.teams set clock_extensions_used = 0 where id = v_team.id;
  update public.drafts set
    current_pick = v_draft.current_pick + 1,
    status = case when v_draft.current_pick = v_total_picks then 'complete' else 'active' end,
    pick_deadline_at = case
      when v_draft.current_pick = v_total_picks then null
      else now() + make_interval(secs => pick_seconds)
    end,
    paused_remaining_seconds = null
  where id = p_draft_id;

  return v_pick;
end;
$function$;

revoke all on function public.record_draft_pick(uuid, uuid, boolean) from public, anon, authenticated;
