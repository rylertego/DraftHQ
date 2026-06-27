-- Add team_count to leagues: the commissioner-set active team capacity for the league.
-- Archived teams (future M8) will not count toward this total.

alter table public.leagues
  add column if not exists team_count integer not null default 12
    check (team_count between 2 and 32);

-- Replace update_league_settings to include p_team_count
create or replace function public.update_league_settings(
  p_league_id       uuid,
  p_name            text,
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
  v_user_id uuid;
  v_league  public.leagues%rowtype;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = 'PGRST301';
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

  update public.leagues
  set
    name            = trim(p_name),
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

-- Grant covers both the old 7-arg signature (still callable) and the new 8-arg one
revoke all on function public.update_league_settings(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_league_settings(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_league_settings(uuid, text, text, text, text, text, text, integer) to authenticated;
