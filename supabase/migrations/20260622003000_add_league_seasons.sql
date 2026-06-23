create table public.league_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  name text not null check (char_length(trim(name)) between 1 and 100),
  status text not null default 'upcoming' check (
    status in ('upcoming', 'drafting', 'active', 'complete')
  ),
  draft_id uuid references public.drafts(id) on delete set null,
  unique (league_id, year),
  unique (draft_id)
);

create table public.league_team_seasons (
  id uuid primary key default gen_random_uuid(),
  league_season_id uuid not null
    references public.league_seasons(id) on delete cascade,
  league_team_id uuid not null
    references public.league_teams(id) on delete restrict,
  owner_user_id uuid references auth.users(id) on delete set null,
  draft_position integer not null check (draft_position between 1 and 20),
  draft_team_id uuid references public.teams(id) on delete set null,
  unique (league_season_id, league_team_id),
  unique (league_season_id, draft_position),
  unique (draft_team_id)
);

create index league_seasons_league_year_idx
on public.league_seasons (league_id, year desc);

create index league_team_seasons_owner_user_id_idx
on public.league_team_seasons (owner_user_id);

alter table public.league_seasons enable row level security;
alter table public.league_team_seasons enable row level security;

create or replace function public.league_id_for_season(target_season_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select league_id
  from public.league_seasons
  where id = target_season_id;
$$;

revoke all on function public.league_id_for_season(uuid) from public, anon;
grant execute on function public.league_id_for_season(uuid) to authenticated;

create policy "Members can view league seasons"
on public.league_seasons
for select
to authenticated
using (public.is_league_member(league_id));

create policy "Commissioners can add league seasons"
on public.league_seasons
for insert
to authenticated
with check (public.is_league_commissioner(league_id));

create policy "Commissioners can update league seasons"
on public.league_seasons
for update
to authenticated
using (public.is_league_commissioner(league_id))
with check (public.is_league_commissioner(league_id));

create policy "Commissioners can remove league seasons"
on public.league_seasons
for delete
to authenticated
using (public.is_league_commissioner(league_id));

create policy "Members can view league team seasons"
on public.league_team_seasons
for select
to authenticated
using (
  public.is_league_member(
    public.league_id_for_season(league_season_id)
  )
);

create policy "Commissioners can add league team seasons"
on public.league_team_seasons
for insert
to authenticated
with check (
  public.is_league_commissioner(
    public.league_id_for_season(league_season_id)
  )
);

create policy "Commissioners can update league team seasons"
on public.league_team_seasons
for update
to authenticated
using (
  public.is_league_commissioner(
    public.league_id_for_season(league_season_id)
  )
)
with check (
  public.is_league_commissioner(
    public.league_id_for_season(league_season_id)
  )
);

create policy "Commissioners can remove league team seasons"
on public.league_team_seasons
for delete
to authenticated
using (
  public.is_league_commissioner(
    public.league_id_for_season(league_season_id)
  )
);

revoke all on public.league_seasons from anon, authenticated, service_role;
revoke all on public.league_team_seasons from anon, authenticated, service_role;
grant select, insert, update, delete on public.league_seasons to authenticated;
grant select, insert, update, delete on public.league_team_seasons to authenticated;

create or replace function public.can_view_draft(target_draft_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.drafts
    where id = target_draft_id
      and commissioner_user_id = auth.uid()
  ) or exists (
    select 1
    from public.draft_participants
    where draft_id = target_draft_id
      and user_id = auth.uid()
  ) or exists (
    select 1
    from public.drafts
    where id = target_draft_id
      and league_id is not null
      and public.is_league_member(league_id)
  );
$$;

create or replace function public.materialize_league_season(
  p_league_id uuid,
  p_year integer,
  p_name text,
  p_draft_id uuid
)
returns public.league_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.league_seasons%rowtype;
  v_draft public.drafts%rowtype;
  v_draft_team public.teams%rowtype;
  v_league_team_id uuid;
  v_league_team_count integer;
  v_previous_season_id uuid;
  v_owner_user_id uuid;
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

  if v_league_team_count not in (0, v_draft.team_count) then
    raise exception using
      errcode = '22023',
      message = 'League franchise count must match the draft team count.';
  end if;

  for v_draft_team in
    select * from public.teams
    where draft_id = p_draft_id
    order by draft_position
  loop
    if v_league_team_count = 0 then
      insert into public.league_teams (league_id, name, logo_url)
      values (p_league_id, v_draft_team.name, v_draft_team.logo_url)
      returning id into v_league_team_id;
    else
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

    select user_id into v_owner_user_id
    from public.draft_participants
    where draft_id = p_draft_id
      and team_id = v_draft_team.id;

    insert into public.league_team_seasons (
      league_season_id,
      league_team_id,
      owner_user_id,
      draft_position,
      draft_team_id
    ) values (
      v_season.id,
      v_league_team_id,
      v_owner_user_id,
      v_draft_team.draft_position,
      v_draft_team.id
    );
  end loop;

  return v_season;
end;
$$;

revoke all on function public.materialize_league_season(uuid, integer, text, uuid)
from public, anon, authenticated;

create or replace function public.create_league_season_draft(
  p_league_id uuid,
  p_year integer,
  p_season_name text,
  p_draft_name text,
  p_team_count integer,
  p_rounds integer,
  p_display_name text
)
returns public.league_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
begin
  v_draft := public.create_league_draft(
    p_draft_name,
    p_team_count,
    p_rounds,
    p_display_name,
    p_league_id
  );

  return public.materialize_league_season(
    p_league_id,
    p_year,
    p_season_name,
    v_draft.id
  );
end;
$$;

create or replace function public.create_sleeper_league_season(
  p_league_id uuid,
  p_year integer,
  p_season_name text,
  p_draft_name text,
  p_rounds integer,
  p_display_name text,
  p_sleeper_league_id text,
  p_sleeper_draft_id text,
  p_team_names text[],
  p_sleeper_roster_ids integer[],
  p_sleeper_owner_user_ids text[]
)
returns public.league_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.drafts%rowtype;
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using
      errcode = '42501',
      message = 'Only a league commissioner can import a season.';
  end if;

  v_draft := public.create_sleeper_draft(
    p_draft_name,
    p_rounds,
    p_display_name,
    p_sleeper_league_id,
    p_sleeper_draft_id,
    p_team_names,
    p_sleeper_roster_ids,
    p_sleeper_owner_user_ids
  );

  update public.drafts
  set league_id = p_league_id
  where id = v_draft.id;

  return public.materialize_league_season(
    p_league_id,
    p_year,
    p_season_name,
    v_draft.id
  );
end;
$$;

revoke all on function public.create_league_season_draft(
  uuid, integer, text, text, integer, integer, text
) from public, anon;
revoke all on function public.create_sleeper_league_season(
  uuid, integer, text, text, integer, text, text, text, text[], integer[], text[]
) from public, anon;
grant execute on function public.create_league_season_draft(
  uuid, integer, text, text, integer, integer, text
) to authenticated;
grant execute on function public.create_sleeper_league_season(
  uuid, integer, text, text, integer, text, text, text, text[], integer[], text[]
) to authenticated;

create or replace function public.sync_league_season_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.team_id is not null then
    update public.league_team_seasons
    set owner_user_id = null
    where draft_team_id = old.team_id
      and owner_user_id = old.user_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.team_id is not null then
    update public.league_team_seasons
    set owner_user_id = new.user_id
    where draft_team_id = new.team_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_league_season_owner() from public;

create trigger draft_participants_sync_league_season_owner
after insert or update of team_id, user_id or delete
on public.draft_participants
for each row execute function public.sync_league_season_owner();

create or replace function public.sync_league_season_draft_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.league_seasons
  set status = case new.status
    when 'setup' then 'upcoming'
    when 'active' then 'drafting'
    when 'paused' then 'drafting'
    when 'complete' then 'active'
  end
  where draft_id = new.id;

  return new;
end;
$$;

revoke all on function public.sync_league_season_draft_status() from public;

create trigger drafts_sync_league_season_status
after update of status on public.drafts
for each row
when (old.status is distinct from new.status)
execute function public.sync_league_season_draft_status();

create or replace function public.sync_league_team_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.league_teams as league_team
  set
    name = new.name,
    logo_url = coalesce(new.logo_url, league_team.logo_url)
  from public.league_team_seasons as team_season
  where team_season.draft_team_id = new.id
    and league_team.id = team_season.league_team_id;

  return new;
end;
$$;

revoke all on function public.sync_league_team_identity() from public;

create trigger teams_sync_league_team_identity
after update of name, logo_url on public.teams
for each row
when (
  old.name is distinct from new.name
  or old.logo_url is distinct from new.logo_url
)
execute function public.sync_league_team_identity();
