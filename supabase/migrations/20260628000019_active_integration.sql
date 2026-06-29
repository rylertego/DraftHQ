-- Track which integration is active for a league (only one at a time).
alter table public.leagues
  add column if not exists active_integration text default null
    check (active_integration in ('sleeper', 'espn', 'yahoo'));

-- Backfill from existing sleeper connections
update public.leagues
  set active_integration = 'sleeper'
  where sleeper_league_id is not null
    and active_integration is null;

-- RPC to disconnect the active integration
create or replace function public.disconnect_league_integration(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_league_commissioner(p_league_id) then
    raise exception using errcode = '42501', message = 'Only a league commissioner can disconnect an integration.';
  end if;

  update public.leagues set
    active_integration     = null,
    sleeper_league_id      = null,
    sleeper_last_synced_at = null
  where id = p_league_id;
end;
$$;

revoke all on function public.disconnect_league_integration(uuid) from public, anon;
grant execute on function public.disconnect_league_integration(uuid) to authenticated;
