-- Every draft team must end up linked to a league team, because the link is
-- the only thing that carries a My Team edit down into the draft.
--
-- materialize_league_season resolves each draft team to a league team two ways:
-- by the previous season's draft_position, then by offset into league_teams.
-- Both can miss. The link insert sat inside `if v_league_team_id is not null`,
-- so when they did, that draft team was silently skipped — no error, no link,
-- and nothing the commissioner could see.
--
-- Reachable today: a league with 8 franchises creating a 12-team draft. The
-- existing guard only rejects the opposite case (more franchises than draft
-- slots), so positions 9-12 fall through both lookups and end up orphaned.
--
-- Now the miss creates the league team instead of skipping it, which is what
-- the zero-franchise branch already does.
--
-- Also fixes that branch dropping short_name and owner_name when it seeds a
-- league team from a draft team, and teaches both branches about the profile
-- columns added in 20260821022246.

create or replace function public.materialize_league_season(
  p_league_id uuid,
  p_year integer,
  p_name text,
  p_draft_id uuid
)
returns league_seasons
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_season public.league_seasons%rowtype;
  v_draft public.drafts%rowtype;
  v_draft_team public.teams%rowtype;
  v_league_team_id uuid;
  v_league_team_name text;
  v_league_team_short_name text;
  v_league_team_logo_url text;
  v_league_team_owner_name text;
  v_league_team_owner_photo_url text;
  v_league_team_walk_up_songs jsonb;
  v_league_team_count integer;
  v_previous_season_id uuid;
  v_owner_user_id uuid;
  v_owner_display_name text;
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can create a season.';
  end if;

  if p_year is null or p_year not between 2000 and 2100 then
    raise exception using
      errcode = '22023',
      message = 'Season year must be between 2000 and 2100.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'Season name must be between 1 and 100 characters.';
  end if;

  select * into v_draft
  from public.drafts
  where id = p_draft_id
    and league_id = p_league_id
    and commissioner_user_id = auth.uid();

  if v_draft.id is null then
    raise exception using
      errcode = '42501',
      message = 'The draft is not managed by this league commissioner.';
  end if;

  insert into public.league_seasons (league_id, year, name, draft_id)
  values (p_league_id, p_year, trim(p_name), p_draft_id)
  returning * into v_season;

  select count(*)::integer into v_league_team_count
  from public.league_teams
  where league_id = p_league_id;

  select id into v_previous_season_id
  from public.league_seasons
  where league_id = p_league_id
    and id <> v_season.id
  order by year desc
  limit 1;

  if v_league_team_count > v_draft.team_count then
    raise exception using
      errcode = '22023',
      message = 'Active franchise count (' || v_league_team_count || ') exceeds draft team count (' || v_draft.team_count || ').';
  end if;

  for v_draft_team in
    select * from public.teams
    where draft_id = p_draft_id
    order by draft_position
  loop
    v_league_team_id := null;
    v_owner_user_id  := null;

    -- Carry the franchise forward from last season's slot, then fall back to
    -- position order. Either can come back empty.
    if v_league_team_count > 0 then
      select league_team_id into v_league_team_id
      from public.league_team_seasons
      where league_season_id = v_previous_season_id
        and draft_position = v_draft_team.draft_position;

      if v_league_team_id is null then
        select id into v_league_team_id
        from public.league_teams
        where league_id = p_league_id
        order by created_at, id
        offset v_draft_team.draft_position - 1
        limit 1;
      end if;
    end if;

    if v_league_team_id is null then
      -- No franchise to carry forward: create one from the draft team. This is
      -- the path a brand new league takes for every slot, and the path an
      -- under-filled league takes for its surplus slots.
      insert into public.league_teams (
        league_id, name, short_name, logo_url, owner_name, owner_photo_url,
        walk_up_songs, tts_name, autodraft, pre_draft_notes,
        last_season_pick, last_season_record, last_season_playoffs,
        last_season_pick_player
      )
      values (
        p_league_id, v_draft_team.name, v_draft_team.short_name, v_draft_team.logo_url,
        v_draft_team.owner_name, v_draft_team.owner_photo_url,
        v_draft_team.walk_up_songs, v_draft_team.tts_name, coalesce(v_draft_team.autodraft, false),
        v_draft_team.pre_draft_notes,
        v_draft_team.last_season_pick, v_draft_team.last_season_record,
        v_draft_team.last_season_playoffs, v_draft_team.last_season_pick_player
      )
      returning id into v_league_team_id;

      -- An existing participant on this draft team keeps their seat.
      select user_id into v_owner_user_id
      from public.draft_participants
      where draft_id = p_draft_id and team_id = v_draft_team.id;
    else
      select lt.name, lt.short_name, lt.logo_url, lt.owner_name, lt.owner_photo_url, lt.walk_up_songs,
             lt.owner_user_id, p.display_name
      into v_league_team_name, v_league_team_short_name, v_league_team_logo_url,
           v_league_team_owner_name, v_league_team_owner_photo_url, v_league_team_walk_up_songs,
           v_owner_user_id, v_owner_display_name
      from public.league_teams lt
      left join public.profiles p on p.id = lt.owner_user_id
      where lt.id = v_league_team_id;

      update public.teams
      set name            = v_league_team_name,
          short_name      = v_league_team_short_name,
          logo_url        = v_league_team_logo_url,
          owner_name      = coalesce(v_league_team_owner_name, v_owner_display_name),
          owner_photo_url = v_league_team_owner_photo_url,
          walk_up_songs   = coalesce(v_league_team_walk_up_songs, '[]'::jsonb),
          walk_up_songs_overridden = false
      where id = v_draft_team.id;

      if v_owner_user_id is not null then
        update public.draft_participants
        set team_id = null
        where draft_id = p_draft_id and team_id = v_draft_team.id;

        insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
        values (p_draft_id, v_owner_user_id, v_draft_team.id, coalesce(v_league_team_owner_name, v_owner_display_name, 'Owner'), 'owner')
        on conflict (draft_id, user_id) do update
          set team_id = excluded.team_id;
      else
        select user_id into v_owner_user_id
        from public.draft_participants
        where draft_id = p_draft_id and team_id = v_draft_team.id;
      end if;
    end if;

    -- Unconditional now. Previously this sat inside the not-null branch, which
    -- is exactly how draft teams ended up with no link.
    insert into public.league_team_seasons (
      league_season_id, league_team_id, owner_user_id, draft_position, draft_team_id
    ) values (
      v_season.id, v_league_team_id, v_owner_user_id, v_draft_team.draft_position, v_draft_team.id
    );
  end loop;

  return v_season;
end;
$function$;
