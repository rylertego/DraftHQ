-- C1: reset_draft had a dual-check that let anyone with draft_participants.role='commissioner'
-- reset a draft even after ownership was transferred (commissioner_user_id changed but
-- draft_participants rows were not updated). Remove the participant fallback entirely.
-- drafts.commissioner_user_id is the sole source of authority for all destructive draft actions.

drop function if exists public.reset_draft(uuid);

create function public.reset_draft(p_draft_id uuid)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_draft   public.drafts%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = 'PGRST301';
  end if;

  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;

  -- Sole authority check: commissioner_user_id only.
  -- Participant role is NOT a fallback — it can be stale after ownership transfer.
  if v_draft.commissioner_user_id <> v_user_id then
    raise exception 'Only the draft commissioner can reset the draft.' using errcode = '42501';
  end if;

  -- Delete all picks
  delete from public.picks where draft_id = p_draft_id;

  -- Reset team names to "Team {position}" and clear all per-team setup fields
  update public.teams
  set
    name                  = 'Team ' || draft_position,
    short_name            = null,
    tts_name              = null,
    autodraft             = false,
    pre_draft_notes       = null,
    last_season_pick      = null,
    last_season_record    = null,
    last_season_playoffs  = null,
    owner_name            = null,
    owner_photo_url       = null,
    sleeper_roster_id     = null,
    sleeper_owner_user_id = null
  where draft_id = p_draft_id;

  -- Reset draft state and clear schedule
  update public.drafts
  set
    status                   = 'setup',
    current_pick             = 1,
    pick_deadline_at         = null,
    paused_remaining_seconds = null,
    clock_extensions_used    = 0,
    scheduled_at             = null,
    scheduled_timezone       = null,
    updated_at               = now()
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

revoke all on function public.reset_draft(uuid) from public, anon;
grant execute on function public.reset_draft(uuid) to authenticated;

-- Data repair: after a transfer_league_ownership the old commissioner's
-- draft_participants row still carries role='commissioner' even though
-- commissioner_user_id has moved to the new owner. Downgrade those stale rows.
update public.draft_participants dp
set role = 'owner'
from public.drafts d
where dp.draft_id = d.id
  and dp.role = 'commissioner'
  and dp.user_id <> d.commissioner_user_id;
