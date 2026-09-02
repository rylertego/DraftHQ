-- A commissioner pressing "Skip pick" is not the same event as a clock running
-- out, and reusing expire_current_pick for it made the button a no-op.
--
-- expire_current_pick enforces the *automatic* policy: it refuses while the
-- clock is still running, and refuses entirely when timer_behavior is
-- 'nothing'. Both are correct for a timer firing on its own, and both are
-- wrong for a deliberate commissioner action — which is why the button did
-- nothing, silently, since the RPC returns the unchanged draft rather than
-- raising.
--
-- Give the manual action its own entry point: authorize the commissioner, then
-- advance regardless of the clock or the timer policy. p_expected_pick still
-- guards against skipping a pick that already advanced underneath the click.

create or replace function public.commissioner_skip_pick(
  p_draft_id uuid,
  p_expected_pick integer
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft       public.drafts%rowtype;
  v_total_picks integer;
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
      message = 'Only the commissioner can skip a pick.';
  end if;

  if v_draft.status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = case v_draft.status
        when 'setup' then 'The draft has not started.'
        when 'paused' then 'Resume the draft before skipping a pick.'
        else 'The draft is complete.'
      end;
  end if;

  -- Unlike the expiry path this raises rather than returning quietly, so a
  -- stale click reports why nothing happened instead of looking broken.
  if p_expected_pick is null or v_draft.current_pick <> p_expected_pick then
    raise exception using
      errcode = 'P0001',
      message = 'The draft advanced before this skip was submitted.';
  end if;

  v_total_picks := v_draft.team_count * v_draft.rounds;

  if v_draft.current_pick > v_total_picks then
    raise exception using
      errcode = 'P0001',
      message = 'The draft has no remaining picks.';
  end if;

  update public.drafts set
    current_pick             = v_draft.current_pick + 1,
    status                   = case
      when v_draft.current_pick = v_total_picks then 'complete'
      else 'active'
    end,
    pick_deadline_at         = case
      when v_draft.current_pick = v_total_picks then null
      when pick_seconds > 0 then now() + make_interval(secs => pick_seconds)
      else null
    end,
    clock_extensions_used    = 0,
    paused_remaining_seconds = null
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

revoke all on function public.commissioner_skip_pick(uuid, integer) from public;
grant execute on function public.commissioner_skip_pick(uuid, integer) to authenticated;
