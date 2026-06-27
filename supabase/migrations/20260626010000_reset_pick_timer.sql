-- Commissioner can reset the current pick's timer back to the full pick_seconds.
create or replace function public.reset_pick_timer(p_draft_id uuid)
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
    raise exception using errcode = '42501', message = 'Only the commissioner can reset the timer.';
  end if;

  if v_draft.status <> 'active' then
    raise exception using errcode = 'P0001', message = 'Draft must be active to reset the timer.';
  end if;

  if v_draft.pick_seconds = 0 then
    return v_draft;
  end if;

  update public.drafts
  set
    pick_deadline_at = now() + make_interval(secs => pick_seconds),
    clock_extensions_used = 0
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;
