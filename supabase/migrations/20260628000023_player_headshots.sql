alter table public.players
  add column if not exists headshot_url text;

create or replace function public.replace_nflverse_players(p_players jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_imported_count integer;
begin
  if p_players is null or jsonb_typeof(p_players) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Player import must be a JSON array.';
  end if;

  if jsonb_array_length(p_players) < 32 then
    raise exception using
      errcode = '22023',
      message = 'Player import must be an array containing at least 32 records.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_players) as imported (
      external_id text,
      full_name text,
      position text,
      nfl_team text,
      headshot_url text
    )
    where external_id is null
      or char_length(trim(external_id)) = 0
      or full_name is null
      or char_length(trim(full_name)) not between 1 and 100
      or position not in ('QB', 'RB', 'WR', 'TE', 'K', 'DST')
  ) then
    raise exception using
      errcode = '22023',
      message = 'Player import contains an invalid record.';
  end if;

  update public.players
  set active = false
  where source = 'nflverse';

  insert into public.players (
    source,
    external_id,
    full_name,
    position,
    nfl_team,
    headshot_url,
    active
  )
  select
    'nflverse',
    trim(external_id),
    trim(full_name),
    position,
    nullif(trim(nfl_team), ''),
    nullif(trim(headshot_url), ''),
    true
  from jsonb_to_recordset(p_players) as imported (
    external_id text,
    full_name text,
    position text,
    nfl_team text,
    headshot_url text
  )
  on conflict (source, external_id)
  do update set
    full_name = excluded.full_name,
    position = excluded.position,
    nfl_team = excluded.nfl_team,
    headshot_url = excluded.headshot_url,
    active = true;

  get diagnostics v_imported_count = row_count;
  return v_imported_count;
end;
$$;

revoke all on function public.replace_nflverse_players(jsonb)
  from public, anon, authenticated;

grant execute on function public.replace_nflverse_players(jsonb)
  to service_role;
