create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(trim(display_name)) between 1 and 50
  ),
  avatar_url text check (
    avatar_url is null or char_length(avatar_url) <= 2048
  ),
  bio text check (
    bio is null or char_length(bio) <= 280
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated users can view profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Draft Owner'
  );
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(v_display_name, 50))
  on conflict (id) do update set
    display_name = case
      when nullif(trim(new.raw_user_meta_data ->> 'display_name'), '') is null
        then public.profiles.display_name
      else excluded.display_name
    end;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

create trigger auth_user_created_create_profile
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.profiles (id, display_name)
select
  id,
  left(
    coalesce(
      nullif(trim(raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(email, ''), '@', 1), ''),
      'Draft Owner'
    ),
    50
  )
from auth.users
on conflict (id) do nothing;

create or replace function public.create_draft(
  p_name text,
  p_team_count integer,
  p_rounds integer,
  p_display_name text
)
returns public.drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_draft public.drafts%rowtype;
  v_join_code text;
  v_attempts integer := 0;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication is required.';
  end if;

  if auth.jwt() ->> 'is_anonymous' = 'true' then
    raise exception using
      errcode = '42501',
      message = 'Create an account or sign in before creating a draft.';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'Draft name must be between 1 and 100 characters.';
  end if;

  if p_team_count is null or p_team_count not between 2 and 20 then
    raise exception using
      errcode = '22023',
      message = 'Team count must be between 2 and 20.';
  end if;

  if p_rounds is null or p_rounds not between 1 and 30 then
    raise exception using
      errcode = '22023',
      message = 'Rounds must be between 1 and 30.';
  end if;

  select display_name
  into v_display_name
  from public.profiles
  where id = v_user_id;

  v_display_name := coalesce(v_display_name, nullif(trim(p_display_name), ''));

  if v_display_name is null
    or char_length(v_display_name) not between 1 and 50
  then
    raise exception using
      errcode = '22023',
      message = 'A valid profile display name is required.';
  end if;

  loop
    v_join_code := upper(
      substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8)
    );

    begin
      insert into public.drafts (
        name,
        join_code,
        commissioner_user_id,
        team_count,
        rounds
      )
      values (
        trim(p_name),
        v_join_code,
        v_user_id,
        p_team_count,
        p_rounds
      )
      returning * into v_draft;

      exit;
    exception
      when unique_violation then
        v_attempts := v_attempts + 1;

        if v_attempts >= 5 then
          raise exception using
            errcode = 'P0001',
            message = 'Unable to generate a unique join code.';
        end if;
    end;
  end loop;

  insert into public.teams (draft_id, name, draft_position)
  select
    v_draft.id,
    'Team ' || team_position,
    team_position
  from generate_series(1, p_team_count) as positions(team_position);

  insert into public.draft_participants (
    draft_id,
    user_id,
    display_name,
    role
  )
  values (
    v_draft.id,
    v_user_id,
    v_display_name,
    'commissioner'
  );

  return v_draft;
end;
$$;

revoke all on function public.create_draft(text, integer, integer, text)
  from public, anon;
grant execute on function public.create_draft(text, integer, integer, text)
  to authenticated;
