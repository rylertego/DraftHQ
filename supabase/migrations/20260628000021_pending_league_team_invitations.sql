create table if not exists public.league_invitations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_team_id uuid references public.league_teams(id) on delete cascade,
  draft_id uuid references public.drafts(id) on delete cascade,
  draft_team_id uuid references public.teams(id) on delete set null,
  email text not null check (
    email = lower(trim(email)) and char_length(email) between 3 and 320
  ),
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'revoked')
  ),
  invited_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists league_invitations_pending_user_idx
  on public.league_invitations (league_id, invited_user_id)
  where status = 'pending';
create unique index if not exists league_invitations_pending_team_idx
  on public.league_invitations (league_team_id)
  where league_team_id is not null and status = 'pending';
create index if not exists league_invitations_user_status_idx
  on public.league_invitations (invited_user_id, status, invited_at desc);

alter table public.league_invitations enable row level security;

create policy "Invitees and commissioners can view league invitations"
on public.league_invitations for select to authenticated
using (
  invited_user_id = auth.uid()
  or public.is_league_commissioner(league_id)
);

revoke all on public.league_invitations from public, anon, authenticated;
grant select on public.league_invitations to authenticated;
grant select, insert, update on public.league_invitations to service_role;

create or replace function public.get_my_league_invitations()
returns table (
  invitation_id uuid,
  league_id uuid,
  league_slug text,
  league_name text,
  league_logo_url text,
  league_team_id uuid,
  team_name text,
  team_logo_url text,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    l.id,
    l.slug,
    l.name,
    l.logo_url,
    lt.id,
    lt.name,
    lt.logo_url,
    i.invited_at
  from public.league_invitations i
  join public.leagues l on l.id = i.league_id
  left join public.league_teams lt on lt.id = i.league_team_id
  where i.invited_user_id = auth.uid()
    and i.status = 'pending'
  order by i.invited_at desc;
$$;

revoke all on function public.get_my_league_invitations() from public, anon;
grant execute on function public.get_my_league_invitations() to authenticated;

create or replace function public.respond_to_league_invitation(
  p_invitation_id uuid,
  p_response text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.league_invitations%rowtype;
  v_current_owner uuid;
  v_season_id uuid;
  v_draft_id uuid;
  v_draft_team_id uuid;
  v_display_name text;
  v_slug text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in to respond to this invitation.';
  end if;
  if p_response not in ('accepted', 'declined') then
    raise exception using errcode = '22023', message = 'Invitation response is invalid.';
  end if;

  select * into v_invitation
  from public.league_invitations
  where id = p_invitation_id and invited_user_id = v_user_id
  for update;

  if v_invitation.id is null then
    raise exception using errcode = '42501', message = 'Invitation not found.';
  end if;
  if v_invitation.status <> 'pending' then
    raise exception using errcode = '22023', message = 'This invitation has already been answered.';
  end if;

  if p_response = 'declined' then
    update public.league_invitations
    set status = 'declined', responded_at = now()
    where id = v_invitation.id;
    return null;
  end if;

  if v_invitation.league_team_id is not null then
    select owner_user_id into v_current_owner
    from public.league_teams
    where id = v_invitation.league_team_id
      and league_id = v_invitation.league_id
    for update;

    if not found then
      raise exception using errcode = '22023', message = 'The invited team no longer exists.';
    end if;
    if v_current_owner is not null and v_current_owner <> v_user_id then
      raise exception using errcode = '23505', message = 'That team already has an owner.';
    end if;
    if exists (
      select 1 from public.league_teams
      where league_id = v_invitation.league_id
        and owner_user_id = v_user_id
        and id <> v_invitation.league_team_id
    ) then
      raise exception using errcode = '23505', message = 'You already own another team in this league.';
    end if;
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_invitation.league_id, v_user_id, 'member')
  on conflict (league_id, user_id) do nothing;

  if v_invitation.league_team_id is not null then
    update public.league_teams
    set owner_user_id = v_user_id
    where id = v_invitation.league_team_id;

    select ls.id, ls.draft_id, lts.draft_team_id
    into v_season_id, v_draft_id, v_draft_team_id
    from public.league_seasons ls
    join public.league_team_seasons lts
      on lts.league_season_id = ls.id
      and lts.league_team_id = v_invitation.league_team_id
    join public.drafts d on d.id = ls.draft_id and d.status = 'setup'
    where ls.league_id = v_invitation.league_id
    order by ls.year desc
    limit 1;

    if v_draft_id is not null and v_draft_team_id is not null then
      select display_name into v_display_name from public.profiles where id = v_user_id;
      update public.draft_participants
      set team_id = null
      where draft_id = v_draft_id and team_id = v_draft_team_id and user_id <> v_user_id;

      insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
      values (
        v_draft_id,
        v_user_id,
        v_draft_team_id,
        coalesce(v_display_name, split_part(v_invitation.email, '@', 1), 'Owner'),
        'owner'
      )
      on conflict (draft_id, user_id) do update set
        team_id = excluded.team_id,
        role = case when public.draft_participants.role = 'commissioner' then 'commissioner' else 'owner' end;

      update public.league_team_seasons
      set owner_user_id = v_user_id
      where league_season_id = v_season_id
        and league_team_id = v_invitation.league_team_id;
    end if;
  end if;

  update public.league_invitations
  set status = 'accepted', responded_at = now()
  where id = v_invitation.id;

  select slug into v_slug from public.leagues where id = v_invitation.league_id;
  return v_slug;
end;
$$;

revoke all on function public.respond_to_league_invitation(uuid, text) from public, anon;
grant execute on function public.respond_to_league_invitation(uuid, text) to authenticated;

alter table public.league_invitations replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.league_invitations;
  end if;
exception when duplicate_object then null;
end;
$$;
