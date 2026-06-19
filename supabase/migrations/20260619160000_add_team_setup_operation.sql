create or replace function public.rename_teams(
  p_draft_id uuid,
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
    raise exception using
      errcode = 'P0002',
      message = 'Draft not found.';
  end if;

  if v_user_id is null or v_draft.commissioner_user_id <> v_user_id then
    raise exception using
      errcode = '42501',
      message = 'Only the commissioner can rename teams.';
  end if;

  if v_draft.status = 'complete' then
    raise exception using
      errcode = 'P0001',
      message = 'Teams cannot be renamed after draft completion.';
  end if;

  if p_team_names is null
    or cardinality(p_team_names) <> v_draft.team_count
  then
    raise exception using
      errcode = '22023',
      message = 'A name is required for every team.';
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

  with submitted_names as (
    select trim(team_name) as name, draft_position
    from unnest(p_team_names) with ordinality
      as names(team_name, draft_position)
  )
  update public.teams
  set name = submitted_names.name
  from submitted_names
  where teams.draft_id = p_draft_id
    and teams.draft_position = submitted_names.draft_position;

  return query
  select *
  from public.teams
  where draft_id = p_draft_id
  order by draft_position;
end;
$$;

revoke all on function public.rename_teams(uuid, text[])
  from public, anon;

grant execute on function public.rename_teams(uuid, text[])
  to authenticated;
