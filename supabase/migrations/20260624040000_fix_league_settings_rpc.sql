-- Fix 1: Remove the 2048-char length limits on logo_url / banner_url.
-- These were reasonable for external URLs but reject base64 data URLs used
-- as the storage-bucket fallback. Drop and re-add without the length check.

alter table public.leagues drop constraint if exists leagues_logo_url_check;
alter table public.leagues drop constraint if exists leagues_banner_url_check;

-- Fix 2: Replace update_league_settings RPC — remove the invalid
-- ::public.league_theme cast (league_theme is a text CHECK column, not an enum).

create or replace function public.update_league_settings(
  p_league_id       uuid,
  p_name            text,
  p_logo_url        text,
  p_banner_url      text,
  p_primary_color   text,
  p_secondary_color text,
  p_theme           text
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
    theme           = p_theme
  where id = p_league_id
  returning * into v_league;

  return v_league;
end;
$$;

revoke all on function public.update_league_settings(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_league_settings(uuid, text, text, text, text, text, text) to authenticated;
