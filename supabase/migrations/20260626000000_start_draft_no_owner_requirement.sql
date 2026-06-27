-- Remove the requirement that every team must have an assigned owner before
-- starting. The commissioner can make picks on behalf of any unowned team.

create or replace function public.start_draft(p_draft_id uuid)
returns public.drafts
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
      message = 'Only the commissioner can start the draft.';
  end if;

  if v_draft.status <> 'setup' then
    raise exception using
      errcode = 'P0001',
      message = 'Only a draft in setup can be started.';
  end if;

  update public.drafts
  set
    status = 'active',
    pick_deadline_at = now() + make_interval(secs => pick_seconds),
    paused_remaining_seconds = null
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;
