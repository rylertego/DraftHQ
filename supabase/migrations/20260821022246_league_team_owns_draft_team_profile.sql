-- Team identity moves to the league team, which becomes the single place it is
-- edited. Draft Settings stops being a second editor for the same fields.
--
-- The plumbing for this already existed: league_team_seasons joins a league
-- team to the draft team it plays as, and sync_league_team_to_draft_teams
-- pushes name, short_name, logo_url, owner_name, owner_photo_url and
-- walk_up_songs down whenever a league team changes. What was missing is the
-- rest of the profile, so this adds those columns and widens the trigger.

-- ── 1. The columns that only existed on draft teams ────────────────────────
alter table public.league_teams
  add column if not exists tts_name                text,
  add column if not exists autodraft               boolean not null default false,
  add column if not exists pre_draft_notes         text,
  add column if not exists last_season_pick_player text;

comment on column public.league_teams.tts_name is
  'How the announcer pronounces this team. Synced down to draft teams.';
comment on column public.league_teams.autodraft is
  'Auto-pick when on the clock. Synced down to draft teams at the start of each draft.';

-- ── 2. Backfill, before the trigger can overwrite anything ─────────────────
-- The trigger fires on UPDATE of league_teams, so the very first time an owner
-- edited their team name in My Team it would have pushed these new NULL columns
-- over live draft data. Seed the league team from the draft team it is already
-- linked to first.
--
-- A league team can be linked to several draft teams across seasons, so take
-- the most recent draft and ignore the rest. coalesce keeps anything already
-- set on the league team.
with newest_draft_team as (
  select distinct on (lts.league_team_id)
    lts.league_team_id,
    t.tts_name,
    t.autodraft,
    t.pre_draft_notes,
    t.last_season_pick_player,
    t.last_season_pick,
    t.last_season_record,
    t.last_season_playoffs
  from public.league_team_seasons lts
  join public.teams  t on t.id = lts.draft_team_id
  join public.drafts d on d.id = t.draft_id
  order by lts.league_team_id, d.created_at desc
)
update public.league_teams lt
set
  tts_name                = coalesce(lt.tts_name,                ndt.tts_name),
  autodraft               = coalesce(ndt.autodraft,              lt.autodraft),
  pre_draft_notes         = coalesce(lt.pre_draft_notes,         ndt.pre_draft_notes),
  last_season_pick_player = coalesce(lt.last_season_pick_player, ndt.last_season_pick_player),
  last_season_pick        = coalesce(lt.last_season_pick,        ndt.last_season_pick),
  last_season_record      = coalesce(lt.last_season_record,      ndt.last_season_record),
  last_season_playoffs    = coalesce(lt.last_season_playoffs,    ndt.last_season_playoffs)
from newest_draft_team ndt
where ndt.league_team_id = lt.id;

-- ── 3. Widen the sync ──────────────────────────────────────────────────────
create or replace function public.sync_league_team_to_draft_teams()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.name                    is distinct from old.name)
  or (new.short_name              is distinct from old.short_name)
  or (new.logo_url                is distinct from old.logo_url)
  or (new.owner_name              is distinct from old.owner_name)
  or (new.owner_photo_url         is distinct from old.owner_photo_url)
  or (new.walk_up_songs           is distinct from old.walk_up_songs)
  or (new.tts_name                is distinct from old.tts_name)
  or (new.autodraft               is distinct from old.autodraft)
  or (new.pre_draft_notes         is distinct from old.pre_draft_notes)
  or (new.last_season_pick        is distinct from old.last_season_pick)
  or (new.last_season_record      is distinct from old.last_season_record)
  or (new.last_season_playoffs    is distinct from old.last_season_playoffs)
  or (new.last_season_pick_player is distinct from old.last_season_pick_player)
  then
    update public.teams t
    set
      name                    = new.name,
      short_name              = new.short_name,
      logo_url                = new.logo_url,
      owner_name              = new.owner_name,
      owner_photo_url         = new.owner_photo_url,
      tts_name                = new.tts_name,
      pre_draft_notes         = new.pre_draft_notes,
      last_season_pick        = new.last_season_pick,
      last_season_record      = new.last_season_record,
      last_season_playoffs    = new.last_season_playoffs,
      last_season_pick_player = new.last_season_pick_player,
      -- Autodraft is the one field here the draft engine reads on every pick,
      -- and this trigger writes the whole row whenever any watched field
      -- changes. Without this guard, an owner fixing a typo in their team name
      -- mid-draft would also push whatever autodraft value their league profile
      -- happens to hold onto a team that is currently on the clock. Cosmetic
      -- fields keep syncing at any status, which is the existing behaviour.
      autodraft = case
        when exists (
          select 1 from public.drafts d
          where d.id = t.draft_id and d.status = 'setup'
        ) then new.autodraft
        else t.autodraft
      end,
      -- Unchanged: a song list picked for one specific draft still wins over
      -- the league default.
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
