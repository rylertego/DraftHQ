create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (
    char_length(slug) between 3 and 60
    and slug = lower(slug)
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  name text not null check (char_length(trim(name)) between 1 and 100),
  logo_url text check (logo_url is null or char_length(logo_url) <= 2048),
  banner_url text check (banner_url is null or char_length(banner_url) <= 2048),
  primary_color text check (
    primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  secondary_color text check (
    secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  theme text not null default 'classic' check (
    theme in ('classic', 'broadcast', 'dark', 'modern')
  ),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (
    role in ('commissioner', 'member')
  ),
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create table public.league_teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  logo_url text check (logo_url is null or char_length(logo_url) <= 2048),
  created_at timestamptz not null default now()
);

alter table public.drafts
add column league_id uuid references public.leagues(id) on delete set null;

create index leagues_owner_user_id_idx on public.leagues (owner_user_id);
create index league_members_user_id_idx on public.league_members (user_id);
create index league_teams_league_id_idx on public.league_teams (league_id);
create index drafts_league_id_idx on public.drafts (league_id);

create trigger leagues_set_updated_at
before update on public.leagues
for each row execute function public.set_updated_at();

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_teams enable row level security;

create or replace function public.is_league_member(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_members
    where league_id = target_league_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_commissioner(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leagues
    where id = target_league_id
      and owner_user_id = auth.uid()
  ) or exists (
    select 1
    from public.league_members
    where league_id = target_league_id
      and user_id = auth.uid()
      and role = 'commissioner'
  );
$$;

revoke all on function public.is_league_member(uuid) from public, anon;
revoke all on function public.is_league_commissioner(uuid) from public, anon;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_commissioner(uuid) to authenticated;

create policy "Members can view leagues"
on public.leagues
for select
to authenticated
using (public.is_league_member(id));

create policy "Commissioners can update leagues"
on public.leagues
for update
to authenticated
using (public.is_league_commissioner(id))
with check (public.is_league_commissioner(id));

create policy "Commissioners can delete leagues"
on public.leagues
for delete
to authenticated
using (public.is_league_commissioner(id));

create policy "Members can view league memberships"
on public.league_members
for select
to authenticated
using (public.is_league_member(league_id));

create policy "Commissioners can add league memberships"
on public.league_members
for insert
to authenticated
with check (public.is_league_commissioner(league_id));

create policy "Commissioners can update league memberships"
on public.league_members
for update
to authenticated
using (public.is_league_commissioner(league_id))
with check (public.is_league_commissioner(league_id));

create policy "Commissioners can remove league memberships"
on public.league_members
for delete
to authenticated
using (public.is_league_commissioner(league_id));

create policy "Members can view league teams"
on public.league_teams
for select
to authenticated
using (public.is_league_member(league_id));

create policy "Commissioners can add league teams"
on public.league_teams
for insert
to authenticated
with check (public.is_league_commissioner(league_id));

create policy "Commissioners can update league teams"
on public.league_teams
for update
to authenticated
using (public.is_league_commissioner(league_id))
with check (public.is_league_commissioner(league_id));

create policy "Commissioners can remove league teams"
on public.league_teams
for delete
to authenticated
using (public.is_league_commissioner(league_id));

revoke all on public.leagues from anon, authenticated, service_role;
revoke all on public.league_members from anon, authenticated, service_role;
revoke all on public.league_teams from anon, authenticated, service_role;

grant select on public.leagues to authenticated;
grant update (name, logo_url, banner_url, primary_color, secondary_color, theme)
on public.leagues to authenticated;
grant select, insert, update, delete on public.league_members to authenticated;
grant select, insert, update, delete on public.league_teams to authenticated;

create or replace function public.create_league(p_name text, p_slug text)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_slug text := lower(trim(p_slug));
begin
  if v_user_id is null or auth.jwt() ->> 'is_anonymous' = 'true' then
    raise exception using
      errcode = '42501',
      message = 'A persistent account is required to create a league.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'League name must be between 1 and 100 characters.';
  end if;

  if v_slug is null
    or char_length(v_slug) not between 3 and 60
    or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise exception using
      errcode = '22023',
      message = 'League slug must contain lowercase letters, numbers, and single hyphens.';
  end if;

  insert into public.leagues (slug, name, owner_user_id)
  values (v_slug, trim(p_name), v_user_id)
  returning * into v_league;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_user_id, 'commissioner');

  return v_league;
end;
$$;

create or replace function public.create_league_draft(
  p_name text,
  p_team_count integer,
  p_rounds integer,
  p_display_name text,
  p_league_id uuid
)
returns public.drafts
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
      message = 'Only a league commissioner can create a linked draft.';
  end if;

  v_draft := public.create_draft(
    p_name,
    p_team_count,
    p_rounds,
    p_display_name
  );

  update public.drafts
  set league_id = p_league_id
  where id = v_draft.id
  returning * into v_draft;

  return v_draft;
end;
$$;

revoke all on function public.create_league(text, text) from public, anon;
revoke all on function public.create_league_draft(text, integer, integer, text, uuid)
from public, anon;
grant execute on function public.create_league(text, text) to authenticated;
grant execute on function public.create_league_draft(text, integer, integer, text, uuid)
to authenticated;
