alter table public.drafts
add column sleeper_league_id text check (
  sleeper_league_id is null or sleeper_league_id ~ '^[0-9]{5,30}$'
),
add column sleeper_draft_id text check (
  sleeper_draft_id is null or sleeper_draft_id ~ '^[0-9]{5,30}$'
);

alter table public.teams
add column sleeper_roster_id integer check (
  sleeper_roster_id is null or sleeper_roster_id > 0
),
add column sleeper_owner_user_id text check (
  sleeper_owner_user_id is null
  or char_length(sleeper_owner_user_id) between 1 and 100
);

create unique index teams_sleeper_roster_id_idx
on public.teams (draft_id, sleeper_roster_id)
where sleeper_roster_id is not null;

create or replace function public.create_sleeper_draft(
  p_name text,
  p_rounds integer,
  p_display_name text,
  p_sleeper_league_id text,
  p_sleeper_draft_id text,
  p_team_names text[],
  p_sleeper_roster_ids integer[],
  p_sleeper_owner_user_ids text[]
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

  if p_sleeper_league_id is null
    or p_sleeper_league_id !~ '^[0-9]{5,30}$'
    or (p_sleeper_draft_id is not null and p_sleeper_draft_id !~ '^[0-9]{5,30}$')
  then
    raise exception using
      errcode = '22023',
      message = 'Sleeper IDs are invalid.';
  end if;

  if v_team_count is null or v_team_count not between 2 and 20
    or cardinality(p_sleeper_roster_ids) <> v_team_count
    or cardinality(p_sleeper_owner_user_ids) <> v_team_count
  then
    raise exception using
      errcode = '22023',
      message = 'Sleeper team data is incomplete.';
  end if;

  if exists (
    select 1 from unnest(p_team_names) as names(team_name)
    where team_name is null
      or char_length(trim(team_name)) not between 1 and 100
  ) or exists (
    select roster_id from unnest(p_sleeper_roster_ids) as ids(roster_id)
    group by roster_id having roster_id is null or roster_id <= 0 or count(*) > 1
  ) or exists (
    select 1
    from unnest(p_sleeper_owner_user_ids) as ids(owner_user_id)
    where char_length(owner_user_id) > 100
  ) then
    raise exception using
      errcode = '22023',
      message = 'Sleeper teams must have valid names and unique roster IDs.';
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
        name, join_code, commissioner_user_id, team_count, rounds,
        sleeper_league_id, sleeper_draft_id
      ) values (
        trim(p_name), v_join_code, v_user_id, v_team_count, p_rounds,
        p_sleeper_league_id, p_sleeper_draft_id
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

  insert into public.teams (
    draft_id,
    name,
    draft_position,
    sleeper_roster_id,
    sleeper_owner_user_id
  )
  select
    v_draft.id,
    trim(p_team_names[position]),
    position,
    p_sleeper_roster_ids[position],
    nullif(trim(p_sleeper_owner_user_ids[position]), '')
  from generate_series(1, v_team_count) as positions(position);

  insert into public.draft_participants (
    draft_id, user_id, display_name, role
  ) values (
    v_draft.id, v_user_id, v_display_name, 'commissioner'
  );

  return v_draft;
end;
$$;

revoke all on function public.create_sleeper_draft(
  text, integer, text, text, text, text[], integer[], text[]
) from public, anon;

grant execute on function public.create_sleeper_draft(
  text, integer, text, text, text, text[], integer[], text[]
) to authenticated;
