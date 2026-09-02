-- Two leagues are allowed to share a name; only the URL slug has to be unique.
--
-- The slug is derived from the name on the client, so a second league with the
-- same name produced the same slug and failed on leagues_slug_key. That
-- surfaced a raw Postgres constraint error to whoever typed the name second,
-- with no hint that the name was the problem.
--
-- Resolve the collision by appending a counter. Check-then-insert would race:
-- two sessions creating the same name both see the slug as free and one still
-- fails. Let the unique index arbitrate instead and retry on violation — the
-- BEGIN/EXCEPTION block opens a subtransaction, so a failed attempt rolls back
-- on its own and the loop can continue.
--
-- Signature is unchanged: verify-local-migrations.mjs asserts
-- create_league(text, text) exists.

create or replace function public.create_league(p_name text, p_slug text)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id   uuid := auth.uid();
  v_league    public.leagues%rowtype;
  v_slug      text := lower(trim(p_slug));
  v_base      text;
  v_candidate text;
  v_year      integer := extract(year from now())::integer;
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

  -- Leave room for a "-99" suffix inside the 60 character limit, and never
  -- leave a dangling hyphen behind after truncating.
  v_base      := rtrim(left(v_slug, 57), '-');
  v_candidate := v_slug;

  for v_attempt in 1..99 loop
    begin
      insert into public.leagues (slug, name, owner_user_id)
      values (v_candidate, trim(p_name), v_user_id)
      returning * into v_league;
      exit;
    exception when unique_violation then
      v_candidate := v_base || '-' || (v_attempt + 1)::text;
    end;
  end loop;

  if v_league.id is null then
    raise exception using
      errcode = '22023',
      message = 'That league name is unavailable. Try a different one.';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_league.id, v_user_id, 'commissioner');

  -- Auto-create the current-year season (no draft yet)
  insert into public.league_seasons (league_id, year, name)
  values (v_league.id, v_year, v_year::text || ' Season');

  return v_league;
end;
$$;
