# DraftHQ Milestones

## Milestone 1 — Local MVP
Status: Complete

## Milestone 2 — Multiplayer Draft Room
Status: Complete

Goal: Multiple owners can join and draft from phones/laptops.

## Milestone 3 — Live Draft Reliability
Status: Complete

Goal: Refresh, reconnect, timer, undo, and wrong-owner protection are stable.

## Milestone 4A — League-Ready Draft Operations and Mobile RC
Status: Complete

Goal: Turn the reliable draft room into a production-ready release candidate validated across mobile browsers, devices, and realistic full drafts.

## Milestone 4B — League Identity Layer
Status: Complete

Goal: Introduce the persistent league data model and surface league branding in the draft room and a new league settings area. Foundation for all future league-first features.

Schema added: `leagues`, `league_members`, `league_teams`, nullable `league_id` on `drafts`.
Also added: `league_seasons`, `league_team_seasons`, draft chat (`draft_messages`), clock settings, provider import RPCs.

---

## Milestone 5 — Backend Wiring and Functional League Workspace
Status: Complete

Goal: Fix the broken flows (Reset Draft RLS, Add Member 403) that block commissioners from using the league workspace. Correct navigation and header context throughout.

Key work:
- ✅ Fix Reset Draft: `reset_draft` SECURITY DEFINER RPC; DELETE RLS policy on `picks`
- ✅ Fix Add Member 403: commissioner check now falls back to `leagues.commissioner_user_id`; stale JWT fixed via `requireAuthToken()`
- ✅ Home page: "Create Draft" → "Create League"; post-login → `/dashboard`
- ✅ Dashboard: "Draft On: {date}"; removed "New in DraftHQ"
- ✅ League home: "Configure Draft"; draft date shown; "Pre-Draft Lobby" button
- ✅ Draft room: header shows league name (fetched live); branding colors applied
- ✅ "Back to Setup" preserves leagueSlug + tab context throughout
- ✅ `/leagues/new` standalone create page
- 🔲 Logo upload: Supabase Storage bucket `league-assets` (requires Supabase dashboard setup)

Schema additions: `reset_draft` RPC, DELETE RLS on `picks`.

## Milestone 6 — Draft Setup Persistence and Pre-Draft Lobby
Status: Complete

Goal: Every setting visible in the draft setup UI saves to the DB. A pre-draft lobby gives members a place to gather before the draft.

Key work:
- ✅ Migration: teams extended fields (`short_name`, `tts_name`, `autodraft`, `pre_draft_notes`, `owner_name`, `last_season_*`)
- ✅ All team fields wired to `update_team_details` RPC
- ✅ Draft settings (scoring type, landmines, hide rankings, roster positions, schedule) via `update_draft_extras` RPC
- ✅ whammy → landmine rename in DB schema and all TypeScript code
- ✅ Pre-Draft Lobby: "Pre-Draft Lobby" button on league home → `/draft?...` (shows lobby when draft in setup)
- 🔲 Draft Order tab: drag-to-reorder (planned M7)

## Milestone 7 — Draft Room Branding, Timer, and Draft Reliability
Status: Complete

Goal: Apply league branding to the draft room. Fix timer reliability for multi-device. Filter player pool by enabled roster positions.

Key work:
- ✅ League gradient colors applied to draft room header band from league settings
- ✅ League logo in draft room header with correct fallback
- ✅ Roster position filtering in player pool (enabled positions only; DST special case)
- ✅ Position tabs in PickModal are now dynamic (only show positions in the available player pool)
- ✅ Lobby roster redesigned: avatar circles (initials + theme color), online dot, team name, self-highlight
- ✅ Timer reliability: `getDraftServerTimeOffsetMs` extracted; 2-minute periodic re-sync in `useRealtimeDraftRoom` keeps clock accurate during long picks with no realtime activity

## Milestone 7B — Member Profiles
Status: In Progress

Goal: Every league member can edit a per-league profile (nickname, avatar, bio). Every user has a global app profile with image upload.

Key work:
- ✅ `league_members` extended: `nickname`, `avatar_url`, `bio` columns
- ✅ `avatars` Supabase Storage bucket with RLS for global and per-league paths
- ✅ `update_league_member_profile` SECURITY DEFINER RPC (prevents role escalation)
- ✅ App Profile page (`/profile`): real image upload replaces URL field
- ✅ League Members page: current-user detection; "Edit profile" button on own card
- ✅ `EditMemberProfileModal`: nickname, avatar upload, bio; per-league only
- ✅ Member display name + avatar prefers per-league values, falls back to global profile
- 🔲 Password change on `/profile`
- 🔲 Commissioner can view (but not edit) any member's league profile

---

## Milestone 7C — League Teams Page
Status: Complete

Goal: Commissioners can manage franchise teams and assign owners. Assignments carry over automatically to draft slots when a new season is created.

Key work:
- ✅ `league_teams.owner_user_id` column — stores standing franchise owner
- ✅ `assign_league_team_owner` SECURITY DEFINER RPC — updates franchise owner; syncs `draft_participants` and `league_team_seasons` for any active setup-phase draft
- ✅ `materialize_league_season` updated — carries franchise names into draft team slots; auto-creates `draft_participants` from pre-assigned owners on season creation
- ✅ League Teams page (`/leagues/[slug]/teams`) — shows all franchise teams; commissioner can add, rename, delete, assign owners
- ✅ Teams tab added to LeagueWorkspaceHeader for all members

---

## Milestone 8 — League History, Season Archive, and Member Archive
Status: Future

Goal: Give commissioners a way to close out a season and give leagues a historical record.

Key work:
- Season archiving commissioner flow; `league_seasons.status = 'complete'`; picks blocked after archive
- `league_members.archived_at` migration; UI to archive/restore members
- `league_season_members` snapshot table for accurate past-season member counts
- Past seasons page

## Milestone 9 — Rankings, Landmine, and Advanced Draft Features
Status: Future

Goal: Player rankings power the draft board sort. Landmine adds a party-mode penalty mechanic. Whammy columns renamed to landmine.

Key work:
- `player_rankings` table (`player_id`, `scoring_type`, `rank`, `tier`)
- Draft room player board sorts by rank for active scoring type
- Rename `use_whammies`/`whammy_count` → `use_landmines`/`landmine_count` in DB and code
- Landmine assignment: server-side, top 150 eligible players at draft start/reset
- Draft room fullscreen Landmine reveal animation when landmine player is picked
- Commissioner "Reveal Landmine Players" button post-draft-start
- Walk-up songs: per-team Spotify/YouTube URL; plays when team is on clock

## Release Prep — Testing, Docs, RLS, and Deployment Hardening
Status: Future

Goal: Ship a production-quality release on hosted Supabase.

Key work:
- Full RLS audit: all tables verified for correct policies
- E2E test coverage for join → pick → complete flow
- Hosted Supabase deployment: all migrations applied, smoke test, service role grants verified
- `npm run verify:release` passing on hosted instance
