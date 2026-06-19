create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  join_code text not null unique check (
    join_code = upper(join_code)
    and join_code ~ '^[A-Z0-9]{6,12}$'
  ),
  commissioner_user_id uuid not null references auth.users(id),
  team_count integer not null check (team_count between 2 and 20),
  rounds integer not null check (rounds between 1 and 30),
  current_pick integer not null default 1 check (
    current_pick between 1 and (team_count * rounds) + 1
  ),
  status text not null default 'setup' check (
    status in ('setup', 'active', 'paused', 'complete')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  draft_position integer not null check (draft_position between 1 and 20),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, draft_position),
  unique (id, draft_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual' check (char_length(trim(source)) > 0),
  external_id text,
  full_name text not null check (char_length(trim(full_name)) between 1 and 100),
  position text not null check (
    position in ('QB', 'RB', 'WR', 'TE', 'K', 'DST', 'FLEX', 'UNKNOWN')
  ),
  nfl_team text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index players_source_external_id_idx
  on public.players (source, external_id)
  where external_id is not null;

create index players_name_search_idx
  on public.players using gin (to_tsvector('simple', full_name));

create table public.draft_participants (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid,
  display_name text not null check (char_length(trim(display_name)) between 1 and 50),
  role text not null default 'owner' check (
    role in ('commissioner', 'owner', 'viewer')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, user_id),
  unique (id, draft_id),
  foreign key (team_id, draft_id)
    references public.teams (id, draft_id)
    on delete restrict
);

create unique index draft_participants_team_assignment_idx
  on public.draft_participants (draft_id, team_id)
  where team_id is not null;

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  team_id uuid not null,
  player_id uuid not null references public.players(id) on delete restrict,
  participant_id uuid references public.draft_participants(id) on delete set null,
  round integer not null check (round between 1 and 30),
  pick_number integer not null check (pick_number between 1 and 20),
  overall_pick_number integer not null check (overall_pick_number > 0),
  created_at timestamptz not null default now(),
  unique (draft_id, overall_pick_number),
  unique (draft_id, player_id),
  foreign key (team_id, draft_id)
    references public.teams (id, draft_id)
    on delete restrict
);

create index drafts_commissioner_user_id_idx
  on public.drafts (commissioner_user_id);

create index teams_draft_id_idx
  on public.teams (draft_id);

create index draft_participants_user_id_idx
  on public.draft_participants (user_id);

create index picks_draft_order_idx
  on public.picks (draft_id, overall_pick_number);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger drafts_set_updated_at
before update on public.drafts
for each row execute function public.set_updated_at();

create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

create trigger draft_participants_set_updated_at
before update on public.draft_participants
for each row execute function public.set_updated_at();

alter table public.drafts enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.draft_participants enable row level security;
alter table public.picks enable row level security;

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
  );
$$;

revoke all on function public.can_view_draft(uuid) from public;
grant execute on function public.can_view_draft(uuid) to authenticated;

create policy "Members can view drafts"
on public.drafts
for select
to authenticated
using (public.can_view_draft(id));

create policy "Members can view teams"
on public.teams
for select
to authenticated
using (public.can_view_draft(draft_id));

create policy "Authenticated users can view players"
on public.players
for select
to authenticated
using (true);

create policy "Members can view participants"
on public.draft_participants
for select
to authenticated
using (public.can_view_draft(draft_id));

create policy "Members can view picks"
on public.picks
for select
to authenticated
using (public.can_view_draft(draft_id));

revoke all on public.drafts from anon, authenticated;
revoke all on public.teams from anon, authenticated;
revoke all on public.players from anon, authenticated;
revoke all on public.draft_participants from anon, authenticated;
revoke all on public.picks from anon, authenticated;

grant select on public.drafts to authenticated;
grant select on public.teams to authenticated;
grant select on public.players to authenticated;
grant select on public.draft_participants to authenticated;
grant select on public.picks to authenticated;

alter table public.drafts replica identity full;
alter table public.teams replica identity full;
alter table public.draft_participants replica identity full;
alter table public.picks replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime add table public.drafts;
    alter publication supabase_realtime add table public.teams;
    alter publication supabase_realtime add table public.draft_participants;
    alter publication supabase_realtime add table public.picks;
  end if;
end;
$$;
