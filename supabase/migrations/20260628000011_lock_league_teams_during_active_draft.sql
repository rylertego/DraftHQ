create or replace function public.prevent_live_draft_team_roster_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
begin
  v_league_id := case when tg_op = 'DELETE' then old.league_id else new.league_id end;

  if exists (
    select 1
    from public.drafts
    where league_id = v_league_id
      and status in ('active', 'paused')
  ) then
    raise exception using
      errcode = '55000',
      message = 'Teams cannot be added, deleted, archived, or unarchived while a draft is active.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_live_draft_team_roster_changes() from public, anon, authenticated;

drop trigger if exists lock_league_team_roster_during_active_draft on public.league_teams;
create trigger lock_league_team_roster_during_active_draft
before insert or delete or update of archived_at on public.league_teams
for each row
execute function public.prevent_live_draft_team_roster_changes();
