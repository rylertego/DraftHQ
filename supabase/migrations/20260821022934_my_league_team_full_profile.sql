-- update_my_league_team gains the fields that used to be edited in Draft
-- Settings, so My Team can be the single place an owner edits their team.
--
-- Dropped and recreated rather than `create or replace`, because adding
-- parameters changes the signature: replace would leave the old 8-argument
-- version in place beside the new one, and every existing 8-argument call from
-- the deployed client would become ambiguous. Both statements run in one
-- transaction, so there is no window where neither exists.
--
-- The new parameters default to null so a client that has not shipped yet keeps
-- working — but null means "clear this field", not "leave it alone", matching
-- how the existing parameters already behave on this function.

drop function if exists public.update_my_league_team(uuid, uuid, text, text, text, text, text, jsonb);

create function public.update_my_league_team(
  p_league_id               uuid,
  p_team_id                 uuid,
  p_name                    text,
  p_short_name              text,
  p_owner_name              text,
  p_logo_url                text,
  p_owner_photo_url         text,
  p_walk_up_songs           jsonb,
  p_tts_name                text    default null,
  p_autodraft               boolean default null,
  p_pre_draft_notes         text    default null,
  p_last_season_pick_player text    default null,
  p_last_season_record      text    default null,
  p_last_season_playoffs    boolean default null
)
returns league_teams
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_team public.league_teams%rowtype;
  v_songs jsonb := coalesce(p_walk_up_songs, '[]'::jsonb);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in to edit your team.';
  end if;

  select * into v_team
  from public.league_teams
  where id = p_team_id
    and league_id = p_league_id
    and archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Team not found.';
  end if;

  if v_team.owner_user_id is distinct from v_user_id then
    raise exception using errcode = '42501', message = 'You can only edit your assigned team.';
  end if;

  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 100 then
    raise exception using errcode = '22023', message = 'Team name must be between 1 and 100 characters.';
  end if;

  if p_short_name is not null and char_length(trim(p_short_name)) > 10 then
    raise exception using errcode = '22023', message = 'Short name must be 10 characters or fewer.';
  end if;

  if p_owner_name is not null and char_length(trim(p_owner_name)) > 100 then
    raise exception using errcode = '22023', message = 'Display name must be 100 characters or fewer.';
  end if;

  -- Limits match the maxLength the Draft Settings inputs enforced, so moving a
  -- field between screens cannot start rejecting a value that already saved.
  if p_tts_name is not null and char_length(trim(p_tts_name)) > 60 then
    raise exception using errcode = '22023', message = 'Text-to-speech name must be 60 characters or fewer.';
  end if;

  if p_pre_draft_notes is not null and char_length(p_pre_draft_notes) > 2000 then
    raise exception using errcode = '22023', message = 'Pre-draft notes must be 2000 characters or fewer.';
  end if;

  if p_last_season_pick_player is not null and char_length(trim(p_last_season_pick_player)) > 80 then
    raise exception using errcode = '22023', message = 'First round pick must be 80 characters or fewer.';
  end if;

  if p_last_season_record is not null and char_length(trim(p_last_season_record)) > 20 then
    raise exception using errcode = '22023', message = 'Record must be 20 characters or fewer.';
  end if;

  if jsonb_typeof(v_songs) <> 'array' then
    raise exception using errcode = '22023', message = 'Walk-up songs must be an array.';
  end if;

  if jsonb_array_length(v_songs) > 10 then
    raise exception using errcode = '22023', message = 'Choose 10 walk-up songs or fewer.';
  end if;

  update public.league_teams
  set
    name                    = trim(p_name),
    short_name              = nullif(trim(coalesce(p_short_name, '')), ''),
    owner_name              = nullif(trim(coalesce(p_owner_name, '')), ''),
    logo_url                = p_logo_url,
    owner_photo_url         = p_owner_photo_url,
    walk_up_songs           = v_songs,
    tts_name                = nullif(trim(coalesce(p_tts_name, '')), ''),
    -- not-null column, so an omitted value means "off" rather than "unchanged"
    autodraft               = coalesce(p_autodraft, false),
    pre_draft_notes         = nullif(trim(coalesce(p_pre_draft_notes, '')), ''),
    last_season_pick_player = nullif(trim(coalesce(p_last_season_pick_player, '')), ''),
    last_season_record      = nullif(trim(coalesce(p_last_season_record, '')), ''),
    last_season_playoffs    = p_last_season_playoffs
  where id = p_team_id
    and league_id = p_league_id
  returning * into v_team;

  return v_team;
end;
$function$;

grant execute on function public.update_my_league_team(
  uuid, uuid, text, text, text, text, text, jsonb,
  text, boolean, text, text, text, boolean
) to authenticated;
