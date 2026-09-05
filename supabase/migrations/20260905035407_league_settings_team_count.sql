-- Restore active-team capacity saving in league settings.
--
-- 20260625020000 added p_team_count to update_league_settings, but
-- 20260629000008 (which added p_slug) replaced the body with a version that
-- neither took nor wrote team_count. The settings form kept sending the value
-- and the client kept dropping it, so "Active Teams" always reverted to the
-- stored value on refresh.
--
-- Drop every stale overload first: PostgREST resolves by named argument, and a
-- default-valued p_team_count would otherwise make the 8-arg slug call
-- ambiguous against the new 9-arg signature.

drop function if exists public.update_league_settings(uuid, text, text, text, text, text, text);
drop function if exists public.update_league_settings(uuid, text, text, text, text, text, text, integer);
drop function if exists public.update_league_settings(uuid, text, text, text, text, text, text, text);

create function public.update_league_settings(
  p_league_id       uuid,
  p_name            text,
  p_slug            text,
  p_logo_url        text,
  p_banner_url      text,
  p_primary_color   text,
  p_secondary_color text,
  p_theme           text,
  p_team_count      integer default null
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id  uuid;
  v_league   public.leagues%rowtype;
  v_new_slug text := lower(regexp_replace(trim(p_slug), '[^a-z0-9]+', '-', 'g'));
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = 'PGRST301';
  end if;

  -- Validate slug
  v_new_slug := trim(both '-' from v_new_slug);
  if char_length(v_new_slug) < 2 or char_length(v_new_slug) > 80 then
    raise exception 'Slug must be between 2 and 80 characters.' using errcode = '22023';
  end if;
  if v_new_slug !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' then
    raise exception 'Slug may only contain lowercase letters, numbers, and hyphens.' using errcode = '22023';
  end if;

  -- Validate team count up front so the commissioner gets a readable message
  -- instead of a raw check-constraint violation.
  if p_team_count is not null and p_team_count not between 2 and 32 then
    raise exception 'Active teams must be between 2 and 32.' using errcode = '22023';
  end if;

  select * into v_league from public.leagues where id = p_league_id;
  if not found then
    raise exception 'League not found.' using errcode = 'P0002';
  end if;

  if v_league.owner_user_id <> v_user_id then
    if not exists (
      select 1 from public.league_members
       where league_id = p_league_id
         and user_id   = v_user_id
         and role      = 'commissioner'
    ) then
      raise exception 'Only commissioners can update league settings.' using errcode = '42501';
    end if;
  end if;

  -- Check slug uniqueness (ignore self)
  if v_new_slug <> v_league.slug and exists (
    select 1 from public.leagues where slug = v_new_slug
  ) then
    raise exception 'That URL slug is already taken — try a different one.' using errcode = '23505';
  end if;

  update public.leagues
  set
    name            = trim(p_name),
    slug            = v_new_slug,
    logo_url        = nullif(trim(p_logo_url), ''),
    banner_url      = nullif(trim(p_banner_url), ''),
    primary_color   = nullif(trim(p_primary_color), ''),
    secondary_color = nullif(trim(p_secondary_color), ''),
    theme           = p_theme,
    team_count      = coalesce(p_team_count, team_count)
  where id = p_league_id
  returning * into v_league;

  return v_league;
end;
$$;

revoke all on function public.update_league_settings(uuid, text, text, text, text, text, text, text, integer) from public, anon;
grant execute on function public.update_league_settings(uuid, text, text, text, text, text, text, text, integer) to authenticated;
