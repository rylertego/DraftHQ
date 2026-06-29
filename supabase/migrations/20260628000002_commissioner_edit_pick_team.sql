create or replace function public.commissioner_edit_pick(
  p_draft_id            uuid,
  p_overall_pick_number integer,
  p_new_player_id       uuid,
  p_new_team_id         uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
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

  if not exists (
    select 1 from public.picks
    where draft_id = p_draft_id
      and overall_pick_number = p_overall_pick_number
  ) then
    raise exception using errcode = 'P0002', message = 'Pick slot not found.';
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

  -- Validate team belongs to this draft if provided
  if p_new_team_id is not null and not exists (
    select 1 from public.teams
    where id = p_new_team_id and draft_id = p_draft_id
  ) then
    raise exception using errcode = 'P0002', message = 'Team not found in this draft.';
  end if;

  update public.picks
  set
    player_id = p_new_player_id,
    team_id   = coalesce(p_new_team_id, team_id)
  where draft_id = p_draft_id
    and overall_pick_number = p_overall_pick_number;
end;
$$;

revoke all on function public.commissioner_edit_pick(uuid, integer, uuid, uuid) from public, anon;
grant execute on function public.commissioner_edit_pick(uuid, integer, uuid, uuid) to authenticated;
