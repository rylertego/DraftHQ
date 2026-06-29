-- Allow commissioners to change the pick timer while the draft is active.
-- When active, also resets the current pick deadline to now + new pick_seconds.

create or replace function public.configure_draft_timer(
  p_draft_id uuid,
  p_pick_seconds integer,
  p_timer_behavior text default null,
  p_clock_extension_seconds integer default null,
  p_max_clock_extensions integer default null
)
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
      message = 'Only the commissioner can configure the timer.';
  end if;

  if v_draft.status not in ('setup', 'paused', 'active') then
    raise exception using
      errcode = 'P0001',
      message = 'Cannot change the timer after the draft is complete.';
  end if;

  if p_pick_seconds is null or p_pick_seconds not between 15 and 600 then
    raise exception using
      errcode = '22023',
      message = 'Pick timer must be between 15 and 600 seconds.';
  end if;

  if p_timer_behavior is not null
    and p_timer_behavior not in ('nothing', 'skip', 'auto_draft')
  then
    raise exception using
      errcode = '22023',
      message = 'Timer behavior must be nothing, skip, or auto_draft.';
  end if;

  if p_clock_extension_seconds is not null
    and p_clock_extension_seconds not between 0 and 300
  then
    raise exception using
      errcode = '22023',
      message = 'Clock extension must be between 0 and 300 seconds.';
  end if;

  if p_max_clock_extensions is not null
    and p_max_clock_extensions not between 0 and 5
  then
    raise exception using
      errcode = '22023',
      message = 'Max clock extensions must be between 0 and 5.';
  end if;

  update public.drafts set
    pick_seconds               = p_pick_seconds,
    timer_behavior             = coalesce(p_timer_behavior, timer_behavior),
    clock_extension_seconds    = coalesce(p_clock_extension_seconds, clock_extension_seconds),
    max_clock_extensions       = coalesce(p_max_clock_extensions, max_clock_extensions),
    -- When active: reset the live deadline to the new duration
    pick_deadline_at           = case
      when status = 'active' then now() + make_interval(secs => p_pick_seconds)
      else pick_deadline_at
    end,
    -- When paused: update the remaining time to the new duration
    paused_remaining_seconds   = case
      when status = 'paused' then p_pick_seconds
      else paused_remaining_seconds
    end
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

revoke all on function public.configure_draft_timer(uuid, integer, text, integer, integer) from public, anon;
grant execute on function public.configure_draft_timer(uuid, integer, text, integer, integer) to authenticated;
