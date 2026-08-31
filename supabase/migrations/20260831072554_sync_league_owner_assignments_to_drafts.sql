-- League owner assignments must materialize into linked draft participants.
--
-- The league franchise owner lives on league_teams.owner_user_id. The draft
-- room authorizes picks through draft_participants.team_id. If those two drift,
-- the league can say an owner is assigned while the draft room still treats
-- them as unassigned. Keep the draft-facing assignment synchronized for setup
-- and paused drafts, the only statuses where settings are editable.

create or replace function public.sync_league_team_owner_to_draft_assignments(
  p_league_id uuid,
  p_league_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_display_name text;
  v_link record;
begin
  if p_user_id is not null then
    select coalesce(nullif(trim(lt.owner_name), ''), p.display_name, 'Owner')
    into v_display_name
    from public.league_teams lt
    left join public.profiles p on p.id = p_user_id
    where lt.id = p_league_team_id
      and lt.league_id = p_league_id;
  end if;

  for v_link in
    select ls.id as league_season_id,
           ls.draft_id,
           lts.draft_team_id
    from public.league_seasons ls
    join public.league_team_seasons lts
      on lts.league_season_id = ls.id
     and lts.league_team_id = p_league_team_id
    join public.drafts d
      on d.id = ls.draft_id
     and d.league_id = p_league_id
     and d.status in ('setup', 'paused')
    where ls.league_id = p_league_id
      and lts.draft_team_id is not null
  loop
    update public.league_team_seasons
    set owner_user_id = p_user_id
    where league_season_id = v_link.league_season_id
      and league_team_id = p_league_team_id;

    update public.draft_participants
    set team_id = null
    where draft_id = v_link.draft_id
      and team_id = v_link.draft_team_id
      and (p_user_id is null or user_id <> p_user_id);

    if p_user_id is null then
      continue;
    end if;

    insert into public.draft_participants (
      draft_id,
      user_id,
      team_id,
      display_name,
      role
    )
    values (
      v_link.draft_id,
      p_user_id,
      v_link.draft_team_id,
      coalesce(v_display_name, 'Owner'),
      'owner'
    )
    on conflict (draft_id, user_id) do update
      set team_id = excluded.team_id,
          display_name = coalesce(nullif(excluded.display_name, ''), public.draft_participants.display_name),
          role = case
            when public.draft_participants.role = 'commissioner' then public.draft_participants.role
            else 'owner'
          end;
  end loop;
end;
$function$;

revoke all on function public.sync_league_team_owner_to_draft_assignments(uuid, uuid, uuid)
from public, anon, authenticated;

create or replace function public.assign_league_team_owner(
  p_league_id uuid,
  p_league_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can assign team owners.';
  end if;

  if not exists (
    select 1
    from public.league_teams
    where id = p_league_team_id
      and league_id = p_league_id
      and archived_at is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'Team does not belong to this league.';
  end if;

  if p_user_id is not null and not exists (
    select 1
    from public.league_members
    where league_id = p_league_id
      and user_id = p_user_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Owner must be a league member.';
  end if;

  update public.league_teams
  set owner_user_id = p_user_id
  where id = p_league_team_id
    and league_id = p_league_id;

  perform public.sync_league_team_owner_to_draft_assignments(
    p_league_id,
    p_league_team_id,
    p_user_id
  );
end;
$function$;

revoke all on function public.assign_league_team_owner(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.assign_league_team_owner(uuid, uuid, uuid)
to authenticated;

create or replace function public.assign_draft_team_owner_from_league_member(
  p_draft_id uuid,
  p_draft_team_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_draft public.drafts%rowtype;
  v_league_team_id uuid;
begin
  select * into v_draft
  from public.drafts
  where id = p_draft_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Draft not found.';
  end if;

  if v_draft.league_id is null then
    raise exception using
      errcode = '22023',
      message = 'This draft is not linked to a league.';
  end if;

  if not public.is_league_commissioner(v_draft.league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can assign team owners.';
  end if;

  if v_draft.status not in ('setup', 'paused') then
    raise exception using
      errcode = 'P0001',
      message = 'Pause the draft before changing team assignments.';
  end if;

  if not exists (
    select 1
    from public.teams
    where id = p_draft_team_id
      and draft_id = p_draft_id
  ) then
    raise exception using errcode = 'P0002', message = 'Team not found in this draft.';
  end if;

  select lts.league_team_id
  into v_league_team_id
  from public.league_team_seasons lts
  join public.league_seasons ls on ls.id = lts.league_season_id
  where ls.draft_id = p_draft_id
    and lts.draft_team_id = p_draft_team_id;

  if v_league_team_id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Draft team is not linked to a league team.';
  end if;

  if p_user_id is not null and not exists (
    select 1
    from public.league_members
    where league_id = v_draft.league_id
      and user_id = p_user_id
  ) then
    raise exception using
      errcode = '22023',
      message = 'Owner must be a league member.';
  end if;

  update public.league_teams
  set owner_user_id = p_user_id
  where id = v_league_team_id
    and league_id = v_draft.league_id;

  perform public.sync_league_team_owner_to_draft_assignments(
    v_draft.league_id,
    v_league_team_id,
    p_user_id
  );
end;
$function$;

revoke all on function public.assign_draft_team_owner_from_league_member(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.assign_draft_team_owner_from_league_member(uuid, uuid, uuid)
to authenticated;
