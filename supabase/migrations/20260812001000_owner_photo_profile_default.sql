-- Durable owner photo defaults for franchise profiles.
--
-- Owners upload this from My Team. The image URL lives on league_teams and is
-- copied into draft teams so draft-night screens can show the owner photo.

alter table public.league_teams
  add column if not exists owner_photo_url text;

-- Backfill league-level owner photos from the most recent linked draft team
-- that already has a photo.
update public.league_teams lt
set owner_photo_url = t.owner_photo_url
from public.league_team_seasons lts
join public.teams t on t.id = lts.draft_team_id
join public.league_seasons ls on ls.id = lts.league_season_id
where lts.league_team_id = lt.id
  and lt.owner_photo_url is null
  and t.owner_photo_url is not null
  and ls.year = (
    select max(ls2.year)
    from public.league_team_seasons lts2
    join public.league_seasons ls2 on ls2.id = lts2.league_season_id
    join public.teams t2 on t2.id = lts2.draft_team_id
    where lts2.league_team_id = lt.id
      and t2.owner_photo_url is not null
  );

drop function if exists public.update_my_league_team(uuid, uuid, text, text, text, text, jsonb);

create or replace function public.update_my_league_team(
  p_league_id uuid,
  p_team_id uuid,
  p_name text,
  p_short_name text,
  p_owner_name text,
  p_logo_url text,
  p_owner_photo_url text,
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
    owner_photo_url = p_owner_photo_url,
    walk_up_songs = v_songs
  where id = p_team_id
    and league_id = p_league_id
  returning * into v_team;

  return v_team;
end;
$$;

revoke all on function public.update_my_league_team(uuid, uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.update_my_league_team(uuid, uuid, text, text, text, text, text, jsonb) to authenticated;

create or replace function public.sync_league_team_to_draft_teams()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.name            is distinct from old.name)
  or (new.short_name      is distinct from old.short_name)
  or (new.logo_url        is distinct from old.logo_url)
  or (new.owner_name      is distinct from old.owner_name)
  or (new.owner_photo_url is distinct from old.owner_photo_url)
  or (new.walk_up_songs   is distinct from old.walk_up_songs)
  then
    update public.teams t
    set
      name            = new.name,
      short_name      = new.short_name,
      logo_url        = new.logo_url,
      owner_name      = new.owner_name,
      owner_photo_url = new.owner_photo_url,
      walk_up_songs   = case
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
  v_league_team_owner_photo_url text;
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
      insert into public.league_teams (league_id, name, logo_url, owner_photo_url, walk_up_songs)
      values (p_league_id, v_draft_team.name, v_draft_team.logo_url, v_draft_team.owner_photo_url, v_draft_team.walk_up_songs)
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
        select lt.name, lt.short_name, lt.logo_url, lt.owner_name, lt.owner_photo_url, lt.walk_up_songs,
               lt.owner_user_id, p.display_name
        into v_league_team_name, v_league_team_short_name, v_league_team_logo_url,
             v_league_team_owner_name, v_league_team_owner_photo_url, v_league_team_walk_up_songs,
             v_owner_user_id, v_owner_display_name
        from public.league_teams lt
        left join public.profiles p on p.id = lt.owner_user_id
        where lt.id = v_league_team_id;

        update public.teams
        set name            = v_league_team_name,
            short_name      = v_league_team_short_name,
            logo_url        = v_league_team_logo_url,
            owner_name      = coalesce(v_league_team_owner_name, v_owner_display_name),
            owner_photo_url = v_league_team_owner_photo_url,
            walk_up_songs   = coalesce(v_league_team_walk_up_songs, '[]'::jsonb),
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
  v_league_team_owner_photo_url text;
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
        select lt.name, lt.short_name, lt.logo_url, lt.owner_name, lt.owner_photo_url, lt.walk_up_songs,
               lt.owner_user_id, p.display_name
        into v_league_team_name, v_league_team_short_name, v_league_team_logo_url,
             v_league_team_owner_name, v_league_team_owner_photo_url, v_league_team_walk_up_songs,
             v_owner_user_id, v_owner_display_name
        from public.league_teams lt
        left join public.profiles p on p.id = lt.owner_user_id
        where lt.id = v_league_team_id;

        update public.teams
        set name            = v_league_team_name,
            short_name      = v_league_team_short_name,
            logo_url        = v_league_team_logo_url,
            owner_name      = coalesce(v_league_team_owner_name, v_owner_display_name),
            owner_photo_url = v_league_team_owner_photo_url,
            walk_up_songs   = coalesce(v_league_team_walk_up_songs, '[]'::jsonb),
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
