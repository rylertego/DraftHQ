drop function public.make_pick(uuid, uuid);
drop function public.commissioner_make_pick(uuid, uuid);

create function public.make_pick(
  p_draft_id uuid,
  p_player_id uuid,
  p_expected_pick integer
)
returns public.picks
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

  if auth.uid() is null or not public.can_view_draft(p_draft_id) then
    raise exception using errcode = '42501', message = 'Draft access is required.';
  end if;

  if p_expected_pick is null or p_expected_pick <> v_draft.current_pick then
    raise exception using
      errcode = 'P0001',
      message = 'The draft advanced before this pick was submitted. Refresh and try again.';
  end if;

  return public.record_draft_pick(p_draft_id, p_player_id, false);
end;
$$;

create function public.commissioner_make_pick(
  p_draft_id uuid,
  p_player_id uuid,
  p_expected_pick integer
)
returns public.picks
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
      message = 'Only the commissioner can make a recovery pick.';
  end if;

  if p_expected_pick is null or p_expected_pick <> v_draft.current_pick then
    raise exception using
      errcode = 'P0001',
      message = 'The draft advanced before this pick was submitted. Refresh and try again.';
  end if;

  return public.record_draft_pick(p_draft_id, p_player_id, true);
end;
$$;

revoke all on function public.make_pick(uuid, uuid, integer)
  from public, anon;
revoke all on function public.commissioner_make_pick(uuid, uuid, integer)
  from public, anon;

grant execute on function public.make_pick(uuid, uuid, integer)
  to authenticated;
grant execute on function public.commissioner_make_pick(uuid, uuid, integer)
  to authenticated;
