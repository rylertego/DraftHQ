-- Lets the commissioner replace any pick's player without changing draft state
create or replace function public.commissioner_edit_pick(
  p_draft_id          uuid,
  p_overall_pick_number integer,
  p_new_player_id     uuid
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

  -- Verify the pick slot exists
  if not exists (
    select 1 from public.picks
    where draft_id = p_draft_id
      and overall_pick_number = p_overall_pick_number
  ) then
    raise exception using errcode = 'P0002', message = 'Pick slot not found.';
  end if;

  -- Verify the new player exists and is not already drafted in this draft
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

  update public.picks
  set player_id = p_new_player_id
  where draft_id = p_draft_id
    and overall_pick_number = p_overall_pick_number;
end;
$$;

revoke all on function public.commissioner_edit_pick(uuid, integer, uuid) from public, anon;
grant execute on function public.commissioner_edit_pick(uuid, integer, uuid) to authenticated;
