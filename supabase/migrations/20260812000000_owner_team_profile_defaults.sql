-- Owner-editable franchise profile defaults.
--
-- league_teams is the durable franchise record; draft teams are a per-season
-- materialization. Owners can edit only their own public profile fields through
-- update_my_league_team. Commissioners can still override draft walk-up songs
-- in Draft Settings without those choices being overwritten by later franchise
-- default edits.

alter table public.league_teams
  add column if not exists walk_up_songs jsonb not null default '[]'::jsonb;

alter table public.teams
  add column if not exists walk_up_songs_overridden boolean not null default false;

-- Preserve already-configured draft songs as the first league default when a
-- franchise has no durable songs yet. This keeps current leagues from losing
-- the songs commissioners already configured.
update public.league_teams lt
set walk_up_songs = t.walk_up_songs
from public.league_team_seasons lts
join public.teams t on t.id = lts.draft_team_id
join public.league_seasons ls on ls.id = lts.league_season_id
where lts.league_team_id = lt.id
  and lt.walk_up_songs = '[]'::jsonb
  and jsonb_typeof(t.walk_up_songs) = 'array'
  and jsonb_array_length(t.walk_up_songs) > 0
  and ls.year = (
    select max(ls2.year)
    from public.league_team_seasons lts2
    join public.league_seasons ls2 on ls2.id = lts2.league_season_id
    where lts2.league_team_id = lt.id
  );

-- Existing draft teams with songs were hand-configured before the override flag
-- existed. Treat them as draft-specific overrides so new owner defaults do not
-- unexpectedly replace them.
update public.teams
set walk_up_songs_overridden = true
where jsonb_typeof(walk_up_songs) = 'array'
  and jsonb_array_length(walk_up_songs) > 0;

create or replace function public.is_league_team_owner(
  target_league_id uuid,
  target_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_teams
    where id = target_team_id
      and league_id = target_league_id
      and owner_user_id = auth.uid()
      and archived_at is null
  );
$$;

revoke all on function public.is_league_team_owner(uuid, uuid) from public, anon;
grant execute on function public.is_league_team_owner(uuid, uuid) to authenticated;

create or replace function public.update_my_league_team(
  p_league_id uuid,
  p_team_id uuid,
  p_name text,
  p_short_name text,
  p_owner_name text,
  p_logo_url text,
  p_walk_up_songs jsonb
)
returns public.league_teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_team public.league_teams%rowtype;
  v_songs jsonb := coalesce(p_walk_up_songs, '[]'::jsonb);
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in to edit your team.';
  end if;

  select * into v_team
  from public.league_teams
  where id = p_team_id
    and league_id = p_league_id
    and archived_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'Team not found.';
  end if;

  if v_team.owner_user_id is distinct from v_user_id then
    raise exception using errcode = '42501', message = 'You can only edit your assigned team.';
  end if;

  if p_name is null or char_length(trim(p_name)) < 1 or char_length(trim(p_name)) > 100 then
    raise exception using errcode = '22023', message = 'Team name must be between 1 and 100 characters.';
  end if;

  if p_short_name is not null and char_length(trim(p_short_name)) > 10 then
    raise exception using errcode = '22023', message = 'Short name must be 10 characters or fewer.';
  end if;

  if p_owner_name is not null and char_length(trim(p_owner_name)) > 100 then
    raise exception using errcode = '22023', message = 'Display name must be 100 characters or fewer.';
  end if;

  if jsonb_typeof(v_songs) <> 'array' then
    raise exception using errcode = '22023', message = 'Walk-up songs must be an array.';
  end if;

  if jsonb_array_length(v_songs) > 10 then
    raise exception using errcode = '22023', message = 'Choose 10 walk-up songs or fewer.';
  end if;

  update public.league_teams
  set
    name = trim(p_name),
    short_name = nullif(trim(coalesce(p_short_name, '')), ''),
    owner_name = nullif(trim(coalesce(p_owner_name, '')), ''),
    logo_url = p_logo_url,
    walk_up_songs = v_songs
  where id = p_team_id
    and league_id = p_league_id
  returning * into v_team;

  return v_team;
end;
$$;

revoke all on function public.update_my_league_team(uuid, uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.update_my_league_team(uuid, uuid, text, text, text, text, jsonb) to authenticated;

-- Owner upload/replace for their own franchise logo. Existing commissioner
-- policies remain in place.
create policy "league_team_logos_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'league-team-logos'
    and public.is_league_team_owner((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  );

create policy "league_team_logos_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'league-team-logos'
    and public.is_league_team_owner((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  )
  with check (
    bucket_id = 'league-team-logos'
    and public.is_league_team_owner((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  );

create or replace function public.sync_league_team_to_draft_teams()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.name          is distinct from old.name)
  or (new.short_name    is distinct from old.short_name)
  or (new.logo_url      is distinct from old.logo_url)
  or (new.owner_name    is distinct from old.owner_name)
  or (new.walk_up_songs is distinct from old.walk_up_songs)
  then
    update public.teams t
    set
      name          = new.name,
      short_name    = new.short_name,
      logo_url      = new.logo_url,
      owner_name    = new.owner_name,
      walk_up_songs = case
        when t.walk_up_songs_overridden then t.walk_up_songs
        else new.walk_up_songs
      end
    from public.league_team_seasons lts
    where lts.league_team_id = new.id
      and lts.draft_team_id  = t.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_league_team_to_draft_teams on public.league_teams;
create trigger trg_sync_league_team_to_draft_teams
  after update on public.league_teams
  for each row
  execute function public.sync_league_team_to_draft_teams();

create or replace function public.update_team_details(
  p_draft_id            uuid,
  p_team_id             uuid,
  p_name                text        default null,
  p_short_name          text        default null,
  p_tts_name            text        default null,
  p_autodraft           boolean     default null,
  p_pre_draft_notes     text        default null,
  p_last_season_pick    integer     default null,
  p_last_season_record  text        default null,
  p_last_season_playoffs boolean    default null,
  p_owner_name          text        default null,
  p_last_season_pick_player text    default null,
  p_walk_up_songs       jsonb       default null
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft   public.drafts%rowtype;
  v_team    public.teams%rowtype;
begin
  select * into v_draft from public.drafts where id = p_draft_id;
  if not found then
    raise exception 'Draft not found.' using errcode = 'P0002';
  end if;

  select * into v_team from public.teams where id = p_team_id and draft_id = p_draft_id;
  if not found then
    raise exception 'Team not found.' using errcode = 'P0002';
  end if;

  -- Commissioner can edit any team; owner can only edit their own.
  if v_draft.commissioner_user_id <> v_user_id then
    if v_team.owner_user_id is null or v_team.owner_user_id <> v_user_id then
      raise exception 'Not authorized to edit this team.' using errcode = '42501';
    end if;
  end if;

  update public.teams set
    name                     = coalesce(p_name,                   name),
    short_name               = coalesce(p_short_name,             short_name),
    tts_name                 = coalesce(p_tts_name,               tts_name),
    autodraft                = coalesce(p_autodraft,              autodraft),
    pre_draft_notes          = coalesce(p_pre_draft_notes,        pre_draft_notes),
    last_season_pick         = coalesce(p_last_season_pick,       last_season_pick),
    last_season_record       = coalesce(p_last_season_record,     last_season_record),
    last_season_playoffs     = coalesce(p_last_season_playoffs,   last_season_playoffs),
    owner_name               = coalesce(p_owner_name,             owner_name),
    last_season_pick_player  = coalesce(p_last_season_pick_player, last_season_pick_player),
    walk_up_songs            = coalesce(p_walk_up_songs,          walk_up_songs),
    walk_up_songs_overridden = case
      when p_walk_up_songs is null then walk_up_songs_overridden
      else true
    end
  where id = p_team_id
  returning * into v_team;

  return v_team;
end;
$$;

revoke all on function public.update_team_details(uuid, uuid, text, text, text, boolean, text, integer, text, boolean, text, text, jsonb) from public, anon;
grant execute on function public.update_team_details(uuid, uuid, text, text, text, boolean, text, integer, text, boolean, text, text, jsonb) to authenticated;

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
  v_league_team_name text;
  v_league_team_short_name text;
  v_league_team_logo_url text;
  v_league_team_owner_name text;
  v_league_team_walk_up_songs jsonb;
  v_league_team_count integer;
  v_previous_season_id uuid;
  v_owner_user_id uuid;
  v_owner_display_name text;
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

  if v_league_team_count > v_draft.team_count then
    raise exception using
      errcode = '22023',
      message = 'Active franchise count (' || v_league_team_count || ') exceeds draft team count (' || v_draft.team_count || ').';
  end if;

  for v_draft_team in
    select * from public.teams
    where draft_id = p_draft_id
    order by draft_position
  loop
    if v_league_team_count = 0 then
      insert into public.league_teams (league_id, name, logo_url, walk_up_songs)
      values (p_league_id, v_draft_team.name, v_draft_team.logo_url, v_draft_team.walk_up_songs)
      returning id into v_league_team_id;

      v_owner_user_id := null;

      insert into public.league_team_seasons (
        league_season_id, league_team_id, owner_user_id, draft_position, draft_team_id
      ) values (
        v_season.id, v_league_team_id, v_owner_user_id, v_draft_team.draft_position, v_draft_team.id
      );
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

      if v_league_team_id is not null then
        select lt.name, lt.short_name, lt.logo_url, lt.owner_name, lt.walk_up_songs,
               lt.owner_user_id, p.display_name
        into v_league_team_name, v_league_team_short_name, v_league_team_logo_url,
             v_league_team_owner_name, v_league_team_walk_up_songs, v_owner_user_id, v_owner_display_name
        from public.league_teams lt
        left join public.profiles p on p.id = lt.owner_user_id
        where lt.id = v_league_team_id;

        update public.teams
        set name          = v_league_team_name,
            short_name    = v_league_team_short_name,
            logo_url      = v_league_team_logo_url,
            owner_name    = coalesce(v_league_team_owner_name, v_owner_display_name),
            walk_up_songs = coalesce(v_league_team_walk_up_songs, '[]'::jsonb),
            walk_up_songs_overridden = false
        where id = v_draft_team.id;

        if v_owner_user_id is not null then
          update public.draft_participants
          set team_id = null
          where draft_id = p_draft_id and team_id = v_draft_team.id;

          insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
          values (p_draft_id, v_owner_user_id, v_draft_team.id, coalesce(v_league_team_owner_name, v_owner_display_name, 'Owner'), 'owner')
          on conflict (draft_id, user_id) do update
            set team_id = excluded.team_id;
        else
          select user_id into v_owner_user_id
          from public.draft_participants
          where draft_id = p_draft_id and team_id = v_draft_team.id;
        end if;

        insert into public.league_team_seasons (
          league_season_id, league_team_id, owner_user_id, draft_position, draft_team_id
        ) values (
          v_season.id, v_league_team_id, v_owner_user_id, v_draft_team.draft_position, v_draft_team.id
        );
      end if;
    end if;
  end loop;

  return v_season;
end;
$$;

revoke all on function public.materialize_league_season(uuid, integer, text, uuid) from public, anon;
grant execute on function public.materialize_league_season(uuid, integer, text, uuid) to authenticated;

create or replace function public.create_draft_for_season(
  p_season_id uuid,
  p_name text,
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
  v_season          public.league_seasons%rowtype;
  v_draft           public.drafts%rowtype;
  v_draft_team      public.teams%rowtype;
  v_league_team_id  uuid;
  v_league_team_count integer;
  v_league_team_name text;
  v_league_team_short_name text;
  v_league_team_logo_url text;
  v_league_team_owner_name text;
  v_league_team_walk_up_songs jsonb;
  v_owner_user_id   uuid;
  v_owner_display_name text;
begin
  select * into v_season
  from public.league_seasons
  where id = p_season_id;

  if v_season.id is null then
    raise exception using errcode = '22023', message = 'Season not found.';
  end if;

  if not public.is_league_commissioner(v_season.league_id) then
    raise exception using errcode = '42501', message = 'Only the commissioner can create a draft.';
  end if;

  if v_season.draft_id is not null then
    raise exception using errcode = '22023', message = 'This season already has a draft.';
  end if;

  v_draft := public.create_league_draft(p_name, p_team_count, p_rounds, p_display_name, v_season.league_id);

  update public.league_seasons
  set draft_id = v_draft.id
  where id = p_season_id
  returning * into v_season;

  select count(*)::integer into v_league_team_count
  from public.league_teams
  where league_id = v_season.league_id and archived_at is null;

  if v_league_team_count > p_team_count then
    raise exception using
      errcode = '22023',
      message = 'Active franchise count (' || v_league_team_count || ') exceeds draft team count (' || p_team_count || ').';
  end if;

  if v_league_team_count > 0 then
    for v_draft_team in
      select * from public.teams
      where draft_id = v_draft.id
      order by draft_position
    loop
      select id into v_league_team_id
      from public.league_teams
      where league_id = v_season.league_id and archived_at is null
      order by created_at, id
      offset v_draft_team.draft_position - 1
      limit 1;

      if v_league_team_id is not null then
        select lt.name, lt.short_name, lt.logo_url, lt.owner_name, lt.walk_up_songs,
               lt.owner_user_id, p.display_name
        into v_league_team_name, v_league_team_short_name, v_league_team_logo_url,
             v_league_team_owner_name, v_league_team_walk_up_songs, v_owner_user_id, v_owner_display_name
        from public.league_teams lt
        left join public.profiles p on p.id = lt.owner_user_id
        where lt.id = v_league_team_id;

        update public.teams
        set name          = v_league_team_name,
            short_name    = v_league_team_short_name,
            logo_url      = v_league_team_logo_url,
            owner_name    = coalesce(v_league_team_owner_name, v_owner_display_name),
            walk_up_songs = coalesce(v_league_team_walk_up_songs, '[]'::jsonb),
            walk_up_songs_overridden = false
        where id = v_draft_team.id;

        if v_owner_user_id is not null then
          update public.draft_participants
          set team_id = null
          where draft_id = v_draft.id and team_id = v_draft_team.id;

          insert into public.draft_participants (draft_id, user_id, team_id, display_name, role)
          values (v_draft.id, v_owner_user_id, v_draft_team.id, coalesce(v_league_team_owner_name, v_owner_display_name, 'Owner'), 'owner')
          on conflict (draft_id, user_id) do update set team_id = excluded.team_id;
        end if;

        insert into public.league_team_seasons (
          league_season_id, league_team_id, owner_user_id, draft_position, draft_team_id
        ) values (
          v_season.id, v_league_team_id, v_owner_user_id, v_draft_team.draft_position, v_draft_team.id
        )
        on conflict (league_season_id, league_team_id) do update
          set owner_user_id  = excluded.owner_user_id,
              draft_position = excluded.draft_position,
              draft_team_id  = excluded.draft_team_id;
      end if;
    end loop;
  end if;

  return v_season;
end;
$$;

revoke all on function public.create_draft_for_season(uuid, text, integer, integer, text) from public, anon;
grant execute on function public.create_draft_for_season(uuid, text, integer, integer, text) to authenticated;
