-- Generic import RPC: creates a draft with named teams from any external provider.
-- Equivalent to create_sleeper_draft without Sleeper-specific columns.
create or replace function public.create_imported_draft(
  p_name text,
  p_rounds integer,
  p_display_name text,
  p_team_names text[]
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_join_code text;
  v_attempts integer := 0;
  v_team_count integer := cardinality(p_team_names);
  v_display_name text;
begin
  if v_user_id is null or auth.jwt() ->> 'is_anonymous' = 'true' then
    raise exception using
      errcode = '42501',
      message = 'A persistent commissioner account is required.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'Draft name must be between 1 and 100 characters.';
  end if;

  if p_rounds is null or p_rounds not between 1 and 30 then
    raise exception using
      errcode = '22023',
      message = 'Rounds must be between 1 and 30.';
  end if;

  if v_team_count is null or v_team_count not between 2 and 20 then
    raise exception using
      errcode = '22023',
      message = 'Team count must be between 2 and 20.';
  end if;

  if exists (
    select 1 from unnest(p_team_names) as t(team_name)
    where team_name is null
      or char_length(trim(team_name)) not between 1 and 100
  ) then
    raise exception using
      errcode = '22023',
      message = 'All team names must be between 1 and 100 characters.';
  end if;

  select display_name into v_display_name
  from public.profiles where id = v_user_id;
  v_display_name := coalesce(v_display_name, nullif(trim(p_display_name), ''));

  if v_display_name is null then
    raise exception using
      errcode = '22023',
      message = 'A valid profile display name is required.';
  end if;

  loop
    v_join_code := upper(
      substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)
    );
    begin
      insert into public.drafts (
        name, join_code, commissioner_user_id, team_count, rounds
      ) values (
        trim(p_name), v_join_code, v_user_id, v_team_count, p_rounds
      ) returning * into v_draft;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then
        raise exception using
          errcode = 'P0001',
          message = 'Unable to generate a unique join code.';
      end if;
    end;
  end loop;

  insert into public.teams (draft_id, name, draft_position)
  select
    v_draft.id,
    trim(p_team_names[pos]),
    pos
  from generate_series(1, v_team_count) as positions(pos);

  insert into public.draft_participants (
    draft_id, user_id, display_name, role
  ) values (
    v_draft.id, v_user_id, v_display_name, 'commissioner'
  );

  return v_draft;
end;
$$;

-- League-season variant: creates the draft then materializes a league_season record.
create or replace function public.create_imported_league_season(
  p_league_id uuid,
  p_year integer,
  p_season_name text,
  p_draft_name text,
  p_rounds integer,
  p_display_name text,
  p_team_names text[]
)
returns public.league_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
begin
  if p_league_id is null or not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can create a season.';
  end if;

  v_draft := public.create_imported_draft(
    p_draft_name,
    p_rounds,
    p_display_name,
    p_team_names
  );

  update public.drafts
  set league_id = p_league_id
  where id = v_draft.id
  returning * into v_draft;

  return public.materialize_league_season(
    p_league_id,
    p_year,
    p_season_name,
    v_draft.id
  );
end;
$$;

revoke all on function public.create_imported_draft(text, integer, text, text[])
  from public, anon;
revoke all on function public.create_imported_league_season(uuid, integer, text, text, integer, text, text[])
  from public, anon;

grant execute on function public.create_imported_draft(text, integer, text, text[])
  to authenticated;
grant execute on function public.create_imported_league_season(uuid, integer, text, text, integer, text, text[])
  to authenticated;
