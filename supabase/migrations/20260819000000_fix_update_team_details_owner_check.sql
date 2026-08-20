-- update_team_details() could never authorise a team owner.
--
-- Its non-commissioner branch read v_team.owner_user_id, and public.teams has
-- no such column. owner_user_id exists on the league-scoped tables — leagues,
-- league_teams, league_team_seasons — but never on the draft-scoped teams
-- table. Confirmed against information_schema on 2026-08-19: no rows.
--
-- plpgsql resolves %rowtype field references at execution, not at creation, so
-- the function created cleanly and only failed when that line ran. A
-- commissioner never reaches it, because the outer test short-circuits. A team
-- owner reaches it every time, and got a runtime "record v_team has no field
-- owner_user_id" instead of being authorised. The visible symptom was edits
-- from Draft Settings appearing to do nothing.
--
-- Fixed by authorising against draft_participants, which is where draft-team
-- ownership actually lives: assign_team() writes the mapping there and returns
-- a draft_participants row. The alternative — adding owner_user_id to
-- public.teams — was rejected deliberately: it would duplicate state that
-- draft_participants already owns, and two sources of truth for the same fact
-- drift.
--
-- Everything else about the function is unchanged.

create or replace function public.update_team_details(
  p_draft_id            uuid,
  p_team_id             uuid,
  p_name                text        default null,
  p_short_name          text        default null,
  p_tts_name            text        default null,
  p_autodraft           boolean     default null,
  p_pre_draft_notes     text        default null,
  p_last_season_pick    integer     default null,
  p_last_season_record  text        default null,
  p_last_season_playoffs boolean    default null,
  p_owner_name          text        default null,
  p_last_season_pick_player text    default null,
  p_walk_up_songs       jsonb       default null
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft   public.drafts%rowtype;
  v_team    public.teams%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sign in to edit a team.' using errcode = '42501';
  end if;

  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;

  select * into v_team from public.teams where id = p_team_id and draft_id = p_draft_id;
  if not found then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

  -- Commissioner can edit any team; the assigned participant can edit only
  -- their own.
  if v_draft.commissioner_user_id <> v_user_id then
    if not exists (
      select 1
      from public.draft_participants dp
      where dp.draft_id = p_draft_id
        and dp.team_id  = p_team_id
        and dp.user_id  = v_user_id
    ) then
      raise exception 'Not authorized to edit this team.' using errcode = '42501';
    end if;
  end if;

  update public.teams set
    name                     = coalesce(p_name,                   name),
    short_name               = coalesce(p_short_name,             short_name),
    tts_name                 = coalesce(p_tts_name,               tts_name),
    autodraft                = coalesce(p_autodraft,              autodraft),
    pre_draft_notes          = coalesce(p_pre_draft_notes,        pre_draft_notes),
    last_season_pick         = coalesce(p_last_season_pick,       last_season_pick),
    last_season_record       = coalesce(p_last_season_record,     last_season_record),
    last_season_playoffs     = coalesce(p_last_season_playoffs,   last_season_playoffs),
    owner_name               = coalesce(p_owner_name,             owner_name),
    last_season_pick_player  = coalesce(p_last_season_pick_player, last_season_pick_player),
    walk_up_songs            = coalesce(p_walk_up_songs,          walk_up_songs),
    walk_up_songs_overridden = case
      when p_walk_up_songs is null then walk_up_songs_overridden
      else true
    end
  where id = p_team_id
  returning * into v_team;

  return v_team;
end;
$$;
