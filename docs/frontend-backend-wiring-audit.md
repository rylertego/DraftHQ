# DraftHQ Frontend–Backend Wiring Audit

_Last updated: 2026-06-24_

This document audits the connection between UI features and their backend/DB backing. For each feature area, it records what the frontend does, what the backend provides, whether a migration is needed, and what is blocking.

---

## Legend

- **Frontend status**: `working` | `partial` | `placeholder` | `broken` | `missing`
- **Backend/DB status**: `working` | `partial` | `missing`
- **Migration needed?**: `yes` | `no` | `done`

---

## League Workspace

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| Create league | working | working | done | `create_league` RPC; slug uniqueness enforced |
| League home page (`/leagues/[slug]`) | working | working | done | Shows seasons, status, reset button |
| League settings page (`/leagues/[slug]/settings`) | partial | working | done | Branding fields save URL strings; no Storage bucket |
| Delete league | working | working | done | Requires typing "DELETE" to confirm |
| Slug-based routing | working | working | done | Slugs are mutable — no redirect-on-slug-change guard |
| League role management (commissioner assignment) | placeholder | partial | no | No UI to promote a member to commissioner; `league_members` role column exists but owner can only be set at invite time |

---

## Dashboard

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| My leagues list | working | working | done | `getMyLeagueWorkspaces` loads all leagues + seasons |
| Status label (upcoming / draft live / in season) | partial | working | no | Shows "Upcoming" when it should show "Draft On: {date}" if `scheduled_at` is set |
| "New in DraftHQ" sidebar section | placeholder | n/a | no | Should be removed (hardcoded copy, not data-driven) |
| "Create League" button | working | working | no | Opens modal |
| Post-login redirect to `/dashboard` | broken | n/a | no | Auth callback redirects to `/create` instead of `/dashboard` |

---

## League Members

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| View members list | working | working | done | `getLeagueSettings` returns members with profiles |
| Add member by email | broken | partial | no | API route at `/api/leagues/[leagueId]/members` returns 403 for league owners; root cause under investigation |
| Remove member | working | working | done | DELETE `/api/leagues/[leagueId]/members` |
| Archive member (`archived_at`) | missing | missing | yes | Column `archived_at` does not exist on `league_members` |
| Restore archived member | missing | missing | no | Depends on `archived_at` column |
| Promote member to commissioner | missing | partial | no | `league_members.role` column exists; no UI or RPC to change role |
| Transfer commissioner role | missing | missing | no | No UI or RPC |

---

## Draft Settings (Teams Setup Page)

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| Team count | working | working | done | `updateDraftTeamCount` — inserts/deletes teams rows |
| Rounds | working | working | done | `updateDraftRounds` |
| Pick timer (seconds) | working | working | done | `configureDraftTimer` RPC |
| Timer behavior (skip/auto_draft/nothing) | working | working | done | `configureDraftTimer` |
| Clock extensions | working | working | done | `configureDraftTimer` |
| Scoring type | working | working | done | `updateDraftExtras` → `scoring_type` column |
| Use whammies / whammy count | working | working | done | `updateDraftExtras` → `use_whammies`, `whammy_count`; rename pending (M9) |
| Hide player rankings | working | working | done | `updateDraftExtras` → `hide_player_rankings` |
| Scheduled date/timezone | working | working | done | `updateDraftSchedule` → `scheduled_at`, `scheduled_timezone` |
| Roster positions | working | working | done | `updateDraftRosterPositions` → `roster_positions jsonb` |
| Team names (Teams tab) | working | working | done | `updateTeamSetup` RPC |
| Team short name | placeholder | missing | yes | TODO comment; `teams.short_name` column missing |
| Team TTS name | placeholder | missing | yes | TODO comment; `teams.tts_name` column missing |
| Autodraft flag | placeholder | missing | yes | TODO comment; `teams.autodraft` column missing |
| Pre-draft notes | placeholder | missing | yes | TODO comment; `teams.pre_draft_notes` column missing |
| Owner name | placeholder | missing | yes | TODO comment; `teams.owner_name` column missing |
| Owner photo URL | placeholder | missing | yes | TODO comment; `teams.owner_photo_url` column missing |
| Last season stats | placeholder | missing | yes | TODO comment; `teams.last_season_*` columns missing |
| Walk-up song | placeholder | missing | yes | TODO comment; `teams.walk_up_song_url` column missing |
| Logo upload (league) | placeholder | missing | yes | Accepts URL string; no Storage bucket |
| Logo upload (team) | placeholder | missing | yes | Accepts URL string; no Storage bucket |
| Draft order reorder + save | partial | working | no | UI allows drag; save not wired to `update_team_setup` reorder |
| Summary sidebar "Enter Draft Room" | placeholder | n/a | no | Should be renamed "Save Changes" or removed; settings save on change already |

---

## Draft Room

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| Realtime picks board | working | working | done | |
| Make pick (own team) | working | working | done | `make_pick` RPC |
| Commissioner make pick | working | working | done | `commissioner_make_pick` RPC |
| Undo pick | working | working | done | `undo_pick` RPC |
| Start draft | working | working | done | `start_draft` RPC |
| Pause/resume draft | working | working | done | `pause_draft`, `resume_draft` RPCs |
| Reset draft | broken | broken | yes | Client calls `DELETE from picks` directly; RLS blocks it |
| Timer display | working | working | done | Client-side countdown against `pick_deadline_at` |
| Timer expiry (skip/auto_draft) | working | working | done | `expire_current_pick` RPC |
| Clock extension | working | working | done | `extend_clock` RPC |
| Chat | working | working | done | `draft_messages` + realtime |
| League name in header | broken | working | no | Header shows `draft.name` instead of fetching `leagues.name` |
| League logo in header | broken | partial | no | No logic to load `leagues.logo_url`; falls back to text |
| League colors in header | missing | working | no | `leagues.primary_color`, `secondary_color` exist; CSS vars not applied |
| "Back to Setup" link | broken | n/a | no | Loses `leagueSlug` and `tab=settings` in URL |
| Roster position filter (player pool) | missing | working | no | `roster_positions` loaded but not applied in player list filter |
| Members in lobby section | missing | working | no | `draft_participants` realtime exists; no UI section near chat |
| Landmine reveal animation | missing | missing | yes | No `landmine_player_ids` column; no reveal UI |
| Player rankings sort | missing | missing | yes | No `player_rankings` table |

---

## Settings (League-Level)

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| League name, logo URL, banner URL | working | working | done | `updateLeagueSettings` |
| Primary/secondary color pickers | working | working | done | Hex color stored in `leagues.primary_color`, `secondary_color` |
| Theme selector | working | working | done | `leagues.theme` enum |
| Danger zone: delete league | working | working | done | |
| Danger zone: archive league | missing | missing | no | No `archived_at` on `leagues` (not yet scoped) |
| Draft defaults (format, rounds, timer) | missing | missing | no | Not yet designed; `league-first-architecture.md` describes it |
| Sleeper integration | working | working | done | Import RPCs; resync not implemented |
| Season creation (manual) | working | working | done | `create_league_season_draft` RPC |
| Season creation (Sleeper import) | working | working | done | `create_sleeper_league_season` RPC |
| Season archiving | missing | missing | yes | No RPC or UI; `league_seasons.status` column exists |

---

## Auth and Navigation

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| Login / signup | working | working | done | Supabase Auth |
| Post-login redirect | broken | n/a | no | Redirects to `/create` instead of `/dashboard` |
| Home page "Create Draft" CTA | broken | n/a | no | Should be "Create League" and link to league creation |
| Home page logged-in state | partial | working | no | Shows "Dashboard" link if logged in; "Create Draft" button unchanged |
| Account nav | working | working | done | `AccountNav.tsx` |
| Anonymous session fallback | working | working | done | `ensureAnonymousUser` for draft participants |

---

## Provider Imports

| Feature | Frontend Status | Backend/DB Status | Migration Needed? | Notes |
|---|---|---|---|---|
| Sleeper import | working | working | done | Preview + create RPCs |
| ESPN preview | working | working | done | `/api/providers/espn/preview` route |
| Yahoo preview | working | working | done | OAuth callback + preview route |
| Fleaflicker preview | working | working | done | |
| MFL preview | working | working | done | |
| Provider → league season import | partial | partial | no | Only Sleeper fully wired through `createSleeperLeagueSeason`; others return preview only |
