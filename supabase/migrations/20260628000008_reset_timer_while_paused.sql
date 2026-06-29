-- Allow commissioners to reset the pick timer while the draft is paused.
-- When paused, resetting writes to paused_remaining_seconds so the full
-- clock starts from scratch on resume. When active, it resets pick_deadline_at
-- as before.

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

  if v_draft.status not in ('active', 'paused') then
    raise exception using errcode = 'P0001', message = 'Draft must be active or paused to reset the timer.';
  end if;

  if v_draft.pick_seconds = 0 then
    return v_draft;
  end if;

  if v_draft.status = 'paused' then
    -- Paused: write full time into paused_remaining_seconds; resume will use it
    update public.drafts
    set
      paused_remaining_seconds = pick_seconds,
      clock_extensions_used    = 0
    where id = p_draft_id
    returning * into v_draft;
  else
    -- Active: reset the live deadline
    update public.drafts
    set
      pick_deadline_at      = now() + make_interval(secs => pick_seconds),
      clock_extensions_used = 0
    where id = p_draft_id
    returning * into v_draft;
  end if;

  return v_draft;
end;
$$;
