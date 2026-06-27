-- M5 Fixes migration
-- 1. reset_draft RPC (SECURITY DEFINER so it can bypass picks RLS)
-- 2. DELETE policy on picks for commissioners (belt-and-suspenders)

-- ── reset_draft RPC ────────────────────────────────────────────────────────

create or replace function public.reset_draft(p_draft_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_draft   public.drafts;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = 'PGRST301';
  end if;

  -- Only the commissioner of the draft may reset it
  select * into v_draft
  from public.drafts
  where id = p_draft_id;

  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;

  if v_draft.commissioner_user_id != v_user_id then
    -- Also allow if the user is a draft participant with commissioner role
    if not exists (
      select 1 from public.draft_participants
      where draft_id = p_draft_id
        and user_id = v_user_id
        and role = 'commissioner'
    ) then
      raise exception 'Only the draft commissioner can reset the draft.' using errcode = '42501';
    end if;
  end if;

  -- Delete all picks for this draft
  delete from public.picks where draft_id = p_draft_id;

  -- Reset the draft to setup state
  update public.drafts
  set
    status                   = 'setup',
    current_pick             = 1,
    pick_deadline_at         = null,
    paused_remaining_seconds = null,
    clock_extensions_used    = 0
  where id = p_draft_id
  returning * into v_draft;

  return jsonb_build_object(
    'id',               v_draft.id,
    'status',           v_draft.status,
    'current_pick',     v_draft.current_pick,
    'pick_deadline_at', v_draft.pick_deadline_at
  );
end;
$$;

revoke all on function public.reset_draft(uuid) from public, anon;
grant execute on function public.reset_draft(uuid) to authenticated;

-- ── Belt-and-suspenders: DELETE policy on picks for commissioners ───────────
-- This allows the client-side delete to work even without going through the RPC,
-- e.g. during local testing or future admin tooling.

create policy "Commissioner can delete picks"
  on public.picks
  for delete
  using (
    exists (
      select 1 from public.drafts d
      where d.id = picks.draft_id
        and d.commissioner_user_id = auth.uid()
    )
    or
    exists (
      select 1 from public.draft_participants dp
      where dp.draft_id = picks.draft_id
        and dp.user_id  = auth.uid()
        and dp.role     = 'commissioner'
    )
  );

-- ── Grant service role access to picks for the reset RPC path ──────────────
grant delete on public.picks to service_role;
