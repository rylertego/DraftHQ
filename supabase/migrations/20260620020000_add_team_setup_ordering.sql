alter table public.teams
  drop constraint teams_draft_id_draft_position_key;

alter table public.teams
  add constraint teams_draft_id_draft_position_key
  unique (draft_id, draft_position)
  deferrable initially immediate;

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

  if v_draft.status <> 'setup' or v_draft.current_pick <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'Draft order can only be changed before the draft starts.';
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

revoke all on function public.update_team_setup(uuid, uuid[], text[])
  from public, anon;

grant execute on function public.update_team_setup(uuid, uuid[], text[])
  to authenticated;
