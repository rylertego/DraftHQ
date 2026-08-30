-- Lock Draft Settings once a draft is live. Commissioners can edit while the
-- draft is in setup or paused, but active/complete drafts reject settings
-- writes at the RPC layer so disabled controls are not the only protection.

create or replace function public.update_draft_extras(
  p_draft_id                uuid,
  p_scoring_type            text        default null,
  p_use_landmines           boolean     default null,
  p_landmine_count          integer     default null,
  p_hide_rankings           boolean     default null,
  p_scheduled_at            timestamptz default null,
  p_scheduled_tz            text        default null,
  p_roster_positions        jsonb       default null,
  p_rounds                  integer     default null,
  p_name                    text        default null,
  p_team_count              integer     default null,
  p_sfx_1_url               text        default null,
  p_sfx_2_url               text        default null,
  p_pos_reactions           text[]      default null,
  p_neg_reactions           text[]      default null,
  p_pick_is_in_enabled      boolean     default null,
  p_pick_is_in_sfx_url      text        default null,
  p_draft_start_audio_url   text        default null,
  p_show_round_slide        boolean     default null,
  p_round_slide_seconds     integer     default null,
  p_round_slide_pauses_clock boolean    default null,
  p_announcer_voice_uri     text        default null,
  p_walk_up_music_mode      text        default null,
  p_awards_song             jsonb       default null,
  p_clear_awards_song       boolean     default null
)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;
  if v_draft.commissioner_user_id <> auth.uid() then
    raise exception 'Only the commissioner can update draft settings.' using errcode = '42501';
  end if;
  if v_draft.status not in ('setup', 'paused') then
    raise exception 'Pause the draft before changing draft settings.' using errcode = 'P0001';
  end if;

  if p_rounds is not null and (p_rounds < 1 or p_rounds > 50) then
    raise exception 'Rounds must be between 1 and 50.';
  end if;
  if p_team_count is not null and (p_team_count < 2 or p_team_count > 32) then
    raise exception 'Team count must be between 2 and 32.';
  end if;
  if p_round_slide_seconds is not null and (p_round_slide_seconds < 1 or p_round_slide_seconds > 60) then
    raise exception 'Round slide seconds must be between 1 and 60.';
  end if;
  if p_walk_up_music_mode is not null and p_walk_up_music_mode not in ('restart', 'resume') then
    raise exception 'Walk-up music mode must be restart or resume.';
  end if;

  update public.drafts set
    scoring_type              = coalesce(p_scoring_type,              scoring_type),
    use_landmines             = coalesce(p_use_landmines,             use_landmines),
    landmine_count            = coalesce(p_landmine_count,            landmine_count),
    hide_player_rankings      = coalesce(p_hide_rankings,             hide_player_rankings),
    scheduled_at              = case when p_scheduled_at is not null or p_scheduled_tz is not null
                                     then p_scheduled_at else scheduled_at end,
    scheduled_timezone        = coalesce(p_scheduled_tz,              scheduled_timezone),
    roster_positions          = coalesce(p_roster_positions,          roster_positions),
    rounds                    = coalesce(p_rounds,                    rounds),
    name                      = coalesce(p_name,                      name),
    team_count                = coalesce(p_team_count,                team_count),
    sfx_1_url                 = coalesce(p_sfx_1_url,                 sfx_1_url),
    sfx_2_url                 = coalesce(p_sfx_2_url,                 sfx_2_url),
    pos_reactions             = coalesce(p_pos_reactions,             pos_reactions),
    neg_reactions             = coalesce(p_neg_reactions,             neg_reactions),
    pick_is_in_enabled        = coalesce(p_pick_is_in_enabled,        pick_is_in_enabled),
    pick_is_in_sfx_url        = coalesce(p_pick_is_in_sfx_url,        pick_is_in_sfx_url),
    draft_start_audio_url     = coalesce(p_draft_start_audio_url,     draft_start_audio_url),
    show_round_slide          = coalesce(p_show_round_slide,          show_round_slide),
    round_slide_seconds       = coalesce(p_round_slide_seconds,       round_slide_seconds),
    round_slide_pauses_clock  = coalesce(p_round_slide_pauses_clock,  round_slide_pauses_clock),
    announcer_voice_uri       = coalesce(p_announcer_voice_uri,       announcer_voice_uri),
    walk_up_music_mode        = coalesce(p_walk_up_music_mode,        walk_up_music_mode),
    awards_song               = case when coalesce(p_clear_awards_song, false)
                                     then null else coalesce(p_awards_song, awards_song) end,
    updated_at                = now()
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

create or replace function public.clear_draft_schedule(p_draft_id uuid)
returns public.drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.drafts%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;
  if v_draft.commissioner_user_id <> auth.uid() then
    raise exception 'Only the commissioner can update draft settings.' using errcode = '42501';
  end if;
  if v_draft.status not in ('setup', 'paused') then
    raise exception 'Pause the draft before changing draft settings.' using errcode = 'P0001';
  end if;

  update public.drafts
  set scheduled_at = null, scheduled_timezone = null, updated_at = now()
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

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

  if v_draft.status not in ('setup', 'paused') then
    raise exception using
      errcode = 'P0001',
      message = 'Pause the draft before changing draft settings.';
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
    paused_remaining_seconds   = case
      when status = 'paused' then p_pick_seconds
      else paused_remaining_seconds
    end
  where id = p_draft_id
  returning * into v_draft;

  return v_draft;
end;
$$;

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
  if v_draft.status not in ('setup', 'paused') then
    raise exception 'Pause the draft before changing draft settings.' using errcode = 'P0001';
  end if;

  select * into v_team from public.teams where id = p_team_id and draft_id = p_draft_id;
  if not found then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

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

create or replace function public.update_team_setup(
  p_draft_id uuid,
  p_team_ids uuid[],
  p_team_names text[]
)
returns setof public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
begin
  select *
  into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_user_id is null or v_draft.commissioner_user_id <> v_user_id then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can update team setup.';
  end if;

  if not (
    v_draft.status = 'setup'
    or (v_draft.status = 'paused' and v_draft.current_pick = 1)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Draft order can only be changed before picks are made.';
  end if;

  if p_team_ids is null
    or p_team_names is null
    or cardinality(p_team_ids) <> v_draft.team_count
    or cardinality(p_team_names) <> v_draft.team_count
  then
    raise exception using
      errcode = '22023',
      message = 'Every team must be included in draft order.';
  end if;

  if (select count(distinct team_id) from unnest(p_team_ids) as ids(team_id))
      <> v_draft.team_count
    or exists (
      select 1
      from unnest(p_team_ids) as ids(team_id)
      where team_id is null
        or not exists (
          select 1 from public.teams
          where teams.id = ids.team_id
            and teams.draft_id = p_draft_id
        )
    )
  then
    raise exception using
      errcode = '22023',
      message = 'Team IDs must match the teams in this draft.';
  end if;

  if exists (
    select 1
    from unnest(p_team_names) as names(team_name)
    where team_name is null
      or char_length(trim(team_name)) not between 1 and 100
  ) then
    raise exception using
      errcode = '22023',
      message = 'Team names must be between 1 and 100 characters.';
  end if;

  set constraints teams_draft_id_draft_position_key deferred;

  with submitted_teams as (
    select
      team_id,
      trim(p_team_names[draft_position]) as name,
      draft_position
    from unnest(p_team_ids) with ordinality
      as ids(team_id, draft_position)
  )
  update public.teams
  set
    name = submitted_teams.name,
    draft_position = submitted_teams.draft_position
  from submitted_teams
  where teams.id = submitted_teams.team_id
    and teams.draft_id = p_draft_id;

  return query
  select *
  from public.teams
  where draft_id = p_draft_id
  order by draft_position;
end;
$$;
