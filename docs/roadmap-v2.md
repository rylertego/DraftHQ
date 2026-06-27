# DraftHQ Roadmap v2

_Last updated: 2026-06-25_

---

## 1. Product Vision

DraftHQ is a commissioner-grade fantasy draft platform — a persistent league workspace where every season, draft, and team history lives in one place. The reliable multiplayer draft room is the core product. Everything else (branding, rankings, media, history) builds on top of it. We ship the draft room first, then grow the workspace around it.

---

## 2. Current Implementation Status

| Feature | Status | Notes |
|---|---|---|
| Multiplayer draft room (picks, realtime, timer) | Working | Core RPC contract is stable |
| Join codes / invite links | Working | Email invitations also functional |
| Commissioner controls (start, pause, resume, undo) | Working | |
| Timer with auto-expiry behaviors | Working | `configure_draft_timer` RPC complete |
| Clock extensions | Working | Per-pick, owner or commissioner |
| Chat (lobby/pre-draft) | Working | `draft_messages` table + realtime |
| Reset Draft | Broken | Fails with "permission denied for table picks" — RLS missing DELETE policy for commissioner |
| League creation flow | Working | `create_league` RPC, slug routing |
| League settings (branding, members) | Partial | UI saves URL strings for logo/banner; no Supabase Storage bucket; commissioner check in Add Member API route uses `role='commissioner'` but DB stores `role='member'` for non-owner admins, causing 403 |
| League workspace (`/leagues/[slug]`) | Working | Shows seasons, status, past seasons |
| Dashboard (`/dashboard`) | Partial | Shows leagues + create. "New in DraftHQ" sidebar section should be removed; status shows "Upcoming" instead of "Draft On: {date}" |
| League seasons (create, link to draft) | Working | `league_seasons`, `league_team_seasons` tables live |
| Season creation (manual, Sleeper import) | Working | RPCs functional |
| Supabase migrations (local) | Working | 18 migrations through `20260622040000` |
| Draft settings — team count, rounds, clock | Working | Direct Supabase updates |
| Draft settings — scoring type, whammies, hide rankings | Working | Columns exist: `scoring_type`, `use_whammies`, `whammy_count`, `hide_player_rankings` |
| Draft settings — scheduled date/timezone | Working | Columns exist: `scheduled_at`, `scheduled_timezone` |
| Draft settings — roster positions | Working | `roster_positions jsonb` column exists; UI saves to DB |
| Draft settings — pre-draft lobby navigation | Placeholder | "Enter 2026 Season" CTA goes to setup page; no dedicated lobby route |
| Draft order tab (reorder + save) | Partial | UI exists; drag-to-reorder not wired to save |
| Teams tab (detailed team fields) | Placeholder | `short_name`, `tts_name`, `autodraft`, `pre_draft_notes`, `owner_name`, `owner_photo_url`, `last_season_*` columns do not exist in DB (7 TODOs in TeamSetupForm.tsx) |
| Logo upload (league + teams) | Placeholder | UI accepts URL strings only; no Supabase Storage bucket |
| Draft room — league name in header | Bug | Header shows draft name, not league name |
| Draft room — "Back to Setup" context | Bug | Loses `tab=settings` and `leagueSlug` on navigation |
| Draft room — league logo | Bug | Falls back incorrectly; no league-logo logic in header |
| Draft room — gradient colors from league settings | Todo | Color CSS variables not applied |
| Home page — "Create Draft" CTA | Bug | Should read "Create League" and redirect to league creation |
| Auth redirect post-login/signup | Bug | Should redirect to `/dashboard`; currently goes to standalone create |
| Roster position filtering in player pool | Todo | `roster_positions` read from DB but not applied in player list filter |
| Player rankings table | Todo | No `player_rankings` table |
| Landmine assignment | Todo | Columns exist (`use_whammies`, `whammy_count`) but need rename + assignment logic |
| Season archiving flow | Todo | No commissioner flow; `status` exists on `league_seasons` |
| Member archive (`archived_at`) | Todo | Column does not exist |
| `league_season_members` snapshot | Todo | Table does not exist |
| Walk-up songs | Todo | Roadmap Phase 7 |
| Broadcast mode | Todo | Route `/leagues/[slug]/broadcast` not implemented |
| E2E tests | Partial | Playwright config exists; coverage gaps |
| RLS audit (hosted) | Todo | Local passes; hosted Supabase not yet deployed |
| Hosted Supabase deployment | Todo | Running on local Supabase only |

---

## 3. Architecture Decisions Needed

| Decision | Options | Recommendation |
|---|---|---|
| League routing: slug vs ID | (A) Slug-only (current) — mutable, readable URLs; (B) ID-only — stable but opaque; (C) Slug + ID hybrid (slug is display, ID is canonical) | Decide before M5 ships. Slug-only is simplest for now if slugs are immutable after creation. Add a slug-edit flow with redirect later. |
| Season archiving model | (A) Commissioner action via league settings; (B) Auto-trigger when draft status becomes `complete` | Recommend (A) — give commissioner explicit control. Auto-trigger can be layered on later. |
| Member archiving | (A) `archived_at` column on `league_members`; (B) Soft-delete with `status` enum | Recommend `archived_at` — simpler, easier to query, preserves history. |
| Logo upload | (A) Supabase Storage bucket `league-assets` with public RLS; (B) External URL input (current); (C) Base64 inline | Recommend (A) — proper storage, CDN, reasonable file size limits. Defer until M5. |
| Draft settings persistence | All columns exist in DB. Issue is: the summary sidebar "Enter Draft Room" button doesn't function as "Save Changes." Settings already save individually via API on blur/change. | Confirm UX intent: auto-save-on-change is already implemented; "Save Changes" CTA may be redundant. |
| Rankings model | Single `player_rankings` table scoped by `scoring_type`; optional `league_player_rankings` override | Defer to M9. Table schema is documented in `docs/roadmap.md`. |
| Landmine model | Rename `use_whammies`/`whammy_count` to `use_landmines`/`landmine_count`; add `landmine_player_ids uuid[]` on drafts | Confirmed direction. Defer rename migration to M9. |
| Themes / branding on draft room | Brand guidelines: draft room always uses DraftHQ base palette (not league custom colors). League colors apply to header/banner only. | Follow brand guidelines strictly. |
| `league_members` role values | DB stores `'member'` and `'commissioner'`. TypeScript type `LeagueRole` has `'commissioner'` and `'member'`. API route `getCommissioner` checks `role !== 'commissioner'`. This is correct for non-owner commissioners who have been assigned the role. The bug is that `create_league` inserts role `'commissioner'` for the owner, and `invite_member` inserts role `'member'` — so a newly added user who is not the owner cannot be promoted to commissioner via the UI yet. | Add role-change UI in M5. |

---

## 4. MVP Scope

The first usable release requires:

1. A league commissioner can create a league, configure a draft, invite members, and run a live multiplayer draft without errors.
2. Reset Draft works (P0 bug).
3. Add Member works for non-owner commissioners (P0 bug or the commissioner must always be the league owner — need to confirm).
4. Draft room shows league name in header and navigates back to settings with full context.
5. Home page and post-login redirect are consistent (league-first UX).
6. All settings that appear in the UI actually persist to the database (they mostly do — verify completeness).
7. Hosted Supabase deployment (not just local).

---

## 5. Post-MVP Scope

In priority order after MVP ships:

1. Logo upload via Supabase Storage
2. Pre-Draft Lobby as a distinct route with member presence
3. Draft Order tab fully functional (drag-to-reorder + save)
4. Teams tab extended fields (`short_name`, `tts_name`, etc.)
5. Roster position filtering in the draft room player pool
6. Season archiving flow (commissioner marks season complete)
7. Member archive
8. Player rankings
9. Landmine mode (rename + assignment + reveal)
10. Walk-up songs
11. **TTS pick announcements** (browser Web Speech API; `tts_name` field already exists)
12. Broadcast mode
13. Records, Hall of Fame

---

## 6. Release Blockers (Numbered)

1. **Reset Draft RLS** — commissioner cannot delete from `picks` table. Missing DELETE policy for commissioner on `picks`. (`priority:P0`)
2. **Add Member 403** — `getCommissioner` check in `/api/leagues/[leagueId]/members` fails for non-owner commissioners because the role check is correct but the invite flow doesn't distinguish owner vs. commissioner role. Need to verify if the `owner_user_id` check in `getCommissioner` covers the league owner. Looking at the code: `getCommissioner` only checks `league_members.role === 'commissioner'`, but the owner inserted via `create_league` also gets `role = 'commissioner'` in `league_members` — so owner *should* pass. The actual bug is likely that the owner's `league_members` row may not exist or the `supabaseAdmin` query fails silently. Needs reproduction. (`priority:P0`)
3. **Draft room header** — shows draft name, not league name. (`priority:P1`)
4. **"Back to Setup"** — loses context (leagueSlug, tab). (`priority:P1`)
5. **Home page CTA** — "Create Draft" should be "Create League". (`priority:P1`)
6. **Auth redirect** — post-login/signup should go to `/dashboard`. (`priority:P1`)
7. **Hosted Supabase deployment** — app is not yet live. (`priority:P0`)
8. **Full RLS audit** on hosted instance. (`priority:P0`)

---

## Milestone 5: Backend Wiring and Functional League Workspace

**Goal:** Fix the broken flows that block commissioners from using the league workspace. Make navigation and header context correct.

**Why it matters:** Commissioners cannot run a draft if Reset fails or Add Member returns 403. Navigation bugs make the product feel broken even when the draft works.

**Backend work:**
- Add DELETE RLS policy on `picks` for commissioner (`commissioner_user_id = auth.uid()` on the parent draft)
- Investigate and fix Add Member 403 (reproduce with a real non-owner commissioner account; check if `owner_user_id` path covers league owners)
- Decide slug vs ID routing (if slug, ensure slug is immutable after creation and add a migration to enforce no-update via RLS)
- Create Supabase Storage bucket `league-assets` (public read, authenticated write with 5MB limit on images)

**Frontend work:**
- Home page: rename "Create Draft" → "Create League"; wire to league creation modal
- Home page: if logged in, show "Dashboard" CTA that goes to `/dashboard`
- Post-login/signup: redirect to `/dashboard`
- Dashboard: replace "Upcoming" status label with "Draft On: {date}" when `scheduled_at` is set; remove "New in DraftHQ" sidebar section
- League home: rename "Enter 2026 Season" → "Configure Draft" when draft is in setup status
- League home: show draft date next to season name if `scheduled_at` is set on the linked draft
- League home: "Pre-Draft" button → navigates to pre-draft lobby (placeholder or lobby route)
- Draft room header: show league name (from `leagues.name` via `drafts.league_id`) instead of draft name
- Draft room "Back to Setup": link to `/teams?draftId={id}&tab=settings&leagueSlug={slug}`
- Draft room logo: use `leagues.logo_url` when `draft.league_id` is set, fall back to DraftHQ logo SVG

**DB/RLS/RPC work:**
- Migration: `picks` DELETE policy for commissioner
- Migration: `league-assets` Storage bucket (or Supabase dashboard config)
- No schema changes required for M5 UI fixes

**Tests needed:**
- RLS: commissioner can DELETE from `picks`; non-commissioner cannot
- RLS: authenticated user cannot DELETE picks from a draft they don't own
- API route: Add Member with owner account succeeds
- API route: Add Member with non-member account returns 403 (correct rejection)
- UI: "Enter 2026 Season" label changes based on draft status

**Acceptance criteria:**
- Reset Draft completes without error for any draft the commissioner owns
- Add Member succeeds when called by the league owner
- Post-login redirect lands on `/dashboard`
- Draft room header shows league name when draft has `league_id`
- "Back to Setup" from draft room preserves leagueSlug and tab in URL

**Priority:** P0/P1 — blocks MVP

---

## Milestone 6: Draft Setup Persistence and Pre-Draft Lobby

**Goal:** Ensure every setting visible in the draft setup UI actually saves to the database. Add a pre-draft lobby route.

**Why it matters:** Commissioners who configure their draft and then enter the draft room should see the settings they chose. Missing columns mean settings silently disappear.

**Backend work:**
- Migration: add missing columns to `teams` table: `short_name text`, `tts_name text`, `autodraft boolean not null default false`, `pre_draft_notes text`, `owner_name text`, `owner_photo_url text`, `last_season_pick integer`, `last_season_record text`, `last_season_playoffs boolean`
- Migration: add `landmine_player_ids uuid[]` placeholder on `drafts` (do not rename whammy columns yet — defer to M9)
- Verify `roster_positions`, `scoring_type`, `scheduled_at`, `scheduled_timezone` columns save correctly end-to-end
- Wire `update_team_setup` RPC to accept extended team fields (or add a separate RPC)

**Frontend work:**
- Draft setup summary sidebar: rename "Enter Draft Room" → "Save Changes" (or add explicit save indicator)
- Add dirty-state indicator per-field (optional: simple "Unsaved changes" banner)
- Draft Order tab: implement drag-to-reorder with save via `update_team_setup`
- Teams tab: wire all 7 TODO fields (short_name, tts_name, autodraft, pre_draft_notes, owner_name, owner_photo_url, last_season_*)
- Walk-up song field: keep placeholder; link to Phase 7
- Logo upload: connect to Supabase Storage bucket (from M5) or show "Coming soon" placeholder

**Pre-Draft Lobby:**
- Route: `/leagues/[slug]/lobby?draftId={id}` (or `/draft/lobby?draftId={id}`)
- Shows: league name/logo, list of joined participants (realtime from `draft_participants`), chat panel (existing `draft_messages`), commissioner "Start Draft" button
- "Pre-Draft" button on league home navigates here
- Commissioner controls: Start Draft enabled when at least 2 participants have assigned teams

**DB/RLS/RPC work:**
- Migration: teams extended fields (see above)
- RPC: `update_team_extended` or extend `update_team_setup` to accept new fields
- No new tables required for pre-draft lobby (uses existing `draft_participants` and `draft_messages`)

**Tests needed:**
- `teams` extended fields save and reload correctly
- Draft Order reorder + save persists to DB
- Pre-Draft Lobby: participants list updates in realtime when a new participant joins
- Pre-Draft Lobby: commissioner Start Draft advances draft to `active` status

**Acceptance criteria:**
- All fields in the Teams tab save to DB
- Draft order reorder is persisted after save
- Pre-Draft Lobby shows members and chat; commissioner can start the draft from the lobby
- Roster positions saved in DB correctly filter the player pool in draft room (see M7)

**Priority:** P0 (settings persistence) / P1 (lobby)

---

## Milestone 7: Draft Room Branding, Timer, and Draft Reliability

**Goal:** Apply league branding to the draft room. Fix timer reliability for multi-device. Filter player pool by enabled roster positions.

**Why it matters:** The draft room is the highest-stakes surface. Branding makes it feel league-specific; timer reliability is safety-critical for a fair draft.

**Backend work:**
- Timer reliability: audit `pick_deadline_at` drift on multi-device; consider server-side expiry via pg_cron or Edge Function instead of client-triggered expiry
- No new schema changes required

**Frontend work:**
- Draft room header: apply `leagues.primary_color` and `leagues.secondary_color` as CSS custom properties (header band only, not the board)
- Draft room header: show `leagues.logo_url` (S3/Supabase URL), fallback to DraftHQ shield SVG
- Draft room lobby section: show joined members list near chat panel
- Player pool filter: read `draft.rosterPositions` and exclude players whose `position` is not in any enabled roster position (DST special case: disabling DST hides team defenses, not IDP rows)
- Timer: audit client-side countdown sync; compare `pick_deadline_at` against server time offset on each tick

**DB/RLS/RPC work:**
- None required; `leagues` branding columns already exist

**Tests needed:**
- Roster position filter: with Kickers disabled, no K players appear in pool
- Roster position filter: with DST disabled, DST players hidden; individual defensive players (IDP) unaffected
- Timer: two clients on different devices see the same remaining time within ±1s
- Timer: expiry triggers correct behavior (skip or auto_draft) when client A calls expire and client B observes the state change

**Acceptance criteria:**
- League primary/secondary colors render in draft room header band when league branding is configured
- League logo appears in draft room header; DraftHQ logo shows when no league logo is set
- Player pool excludes positions disabled in roster settings
- Two devices in the same draft room show countdown within 1 second of each other at all times

**Priority:** P1

---

## Milestone 8: League History, Season Archive, and Member Archive

**Goal:** Give commissioners a way to close out a season and give leagues a historical record.

**Why it matters:** Without archiving, the league home always shows old drafts as "upcoming." Members leaving the league without archive means past-season records are lost.

**Backend work:**
- Migration: add `archived_at timestamptz` to `league_members` (soft-delete for member archive)
- Migration: create `league_season_members` snapshot table: `(id, league_season_id, user_id, display_name, role, snapshot_at)`; populate on season close
- RPC: `archive_league_season(p_league_id uuid, p_season_id uuid)` — sets `league_seasons.status = 'complete'`, prevents further picks (check `season.status = 'complete'` in `make_pick`), snapshots `league_season_members`
- RLS: update policies on `picks` to block insertion when parent season is `complete`

**Frontend work:**
- League settings: "Close Season" / "Archive Season" action for current season (commissioner only, requires confirmation)
- League home: archived seasons shown in Past Seasons with champion slot (editable by commissioner)
- Members page: archived members shown in a collapsed "Former Members" section
- Commissioner UI: restore archived member

**DB/RLS/RPC work:**
- `league_members.archived_at` migration
- `league_season_members` snapshot table + RLS
- `archive_league_season` RPC

**Tests needed:**
- Archived season: `make_pick` returns error after season archived
- `league_season_members` snapshot created on archive
- Archived member: hidden from active members list; visible in former members section

**Acceptance criteria:**
- Commissioner can archive a season; archived season appears in Past Seasons with correct status
- Picks blocked after season archive
- Member archive/restore works without deleting historical `league_team_seasons` records

**Priority:** P2

---

## Milestone 9: Rankings, Landmine, and Advanced Draft Features

**Goal:** Add player rankings to the draft room. Implement the Landmine party feature. Rename whammy columns.

**Why it matters:** Rankings are the core power-user feature for the draft room. Landmine is a differentiating entertainment feature.

**Backend work:**
- Migration: rename `use_whammies` → `use_landmines`, `whammy_count` → `landmine_count` on `drafts` table (coordinate with TypeScript type changes)
- Migration: add `landmine_player_ids uuid[]` to `drafts`
- Migration: create `player_rankings` table: `(id uuid, player_id uuid → players, scoring_type text, rank integer, tier integer nullable, created_at timestamptz)`; unique `(player_id, scoring_type)`
- RPC: `assign_landmines(p_draft_id uuid)` — server-side random selection of N players from top 150 eligible (by rank); stores in `drafts.landmine_player_ids`; called at draft start or reset
- Update `start_draft` and `reset_draft` logic to call `assign_landmines` when `use_landmines = true`
- Optional: `league_player_rankings` override table (scoped to `league_id`) for custom CSV upload

**Frontend work:**
- Rename all `useWhammies`/`whammyCount` TypeScript identifiers to `useLandmines`/`landmineCount`
- Draft room player board: sort by `player_rankings.rank` for active `scoring_type` by default; allow re-sort by position/name
- Draft room: listen for picks where `player_id` is in `drafts.landmine_player_ids`; trigger fullscreen reveal animation
- Draft room hide-rankings: hide rank column and force alphabetical sort when `hide_player_rankings = true`
- Commissioner "Reveal Landmine Players" button in settings sidebar (post-draft-start only) — shows commissioner the assigned landmine player names
- Walk-up songs: per-team Spotify/YouTube URL field in Teams tab; `walk_up_song_url` column on `teams`; plays audio on clock-change event in draft room
- **TTS pick announcements**: on each confirmed pick, use the browser Web Speech API (`window.speechSynthesis`) to announce *"With the Nth pick, [team tts_name or name] selects [player name], [position]"*. Toggle per-user (local preference, no DB column needed). `tts_name` field already exists on `teams` (added M6) for pronunciation overrides. Premium voice API (ElevenLabs / OpenAI TTS) can be layered on later as an optional upgrade.

**DB/RLS/RPC work:**
- Rename migrations (breaking change — coordinate with frontend deploy)
- `player_rankings` table + RLS (select: any authenticated; insert/update/delete: service role only)
- `assign_landmines` RPC

**Tests needed:**
- `assign_landmines`: assigned count matches `landmine_count`; all assigned players are in top 150
- `assign_landmines`: players with keeper status excluded (if keeper feature exists)
- Draft reset re-randomizes landmine assignments
- Rankings: player pool sorts by rank for correct `scoring_type`
- Rankings: `hide_player_rankings` hides rank column

**Acceptance criteria:**
- Player pool sorted by rankings for the configured scoring type
- Landmine reveal fires fullscreen animation when a landmine player is picked
- Commissioner can preview landmine players from settings panel after draft starts
- Walk-up song plays when team comes on clock (if configured)
- TTS announcement fires on each confirmed pick when enabled; uses `tts_name` override if set

**Priority:** P2

---

## Player Headshots

**Goal:** Show real NFL player photos on player board cards in the draft room.

**Data source options (priority order):**
1. **Sleeper CDN** — players imported via Sleeper have `external_id` populated. Sleeper hosts headshots at `https://sleepercdn.com/content/nfl/players/thumb/{external_id}.jpg` (thumbnail) and `.../full/{external_id}.jpg` (full). No auth needed, public CDN.
2. **ESPN CDN** — requires mapping Sleeper player IDs to ESPN player IDs (not trivial). Lower priority.
3. **Custom upload** — commissioner uploads a photo per player. Stored in Supabase Storage `player-assets` bucket. Highest flexibility, highest maintenance.

**Frontend work:**
- Add `imageUrl?: string` field to `Player` type
- In `PlayerListView` card, replace `<PlayerSilhouette>` with `<img src={p.imageUrl} … />` when `imageUrl` is set, fall back to silhouette on error (`onError`)
- Image slot dimensions: `w-16` wide × full card height (already reserved in card layout)
- Lazy-load images (`loading="lazy"`) — player board can have 200+ cards

**Backend / data work:**
- Add `image_url text` column to `players` table (migration)
- On Sleeper import: populate `image_url = 'https://sleepercdn.com/content/nfl/players/thumb/' || external_id || '.jpg'` for all players where `source = 'sleeper'`
- Backfill migration for existing Sleeper players already in DB

**Edge cases:**
- Players with no Sleeper ID (e.g. manually added) show silhouette
- Broken image URLs fall back to silhouette via `onError`
- `hide_player_rankings` setting does NOT affect images

**Priority:** P2

---

## Release Prep: Testing, Docs, RLS, and Deployment Hardening

**Goal:** Ship a production-quality release on hosted Supabase.

**Backend work:**
- Full RLS audit: every table verified for correct policies across `anon`, `authenticated`, and `service_role`
- Hosted Supabase: deploy all migrations; verify service role grants; smoke-test all RPCs

**Frontend work:**
- E2E test coverage: join → pick → complete flow across two simulated users
- Load testing: 12-team draft with all timers active

**DB/RLS/RPC work:**
- `verify:release` script passing on hosted instance: `npm test`, `npm run build`, `npm run test:db:contracts`, `npm run test:integration`, `npm run test:e2e`

**Tests needed:**
- Reset Draft RLS (commissioner can, non-commissioner cannot)
- Add Member commissioner check (owner succeeds, non-member fails correctly)
- Draft settings persistence: all columns round-trip correctly
- Pre-Draft Lobby: realtime member join visible to all participants
- Landmine: assignment, reveal, reset
- Roster position filtering

**Acceptance criteria:**
- `npm run verify:release` passes on hosted Supabase
- Full draft (12 teams, 15 rounds) completes without error on hosted instance
- No service role keys exposed to client

---

## Required Supabase Migrations (Quick Reference)

| Migration | Priority | Status |
|---|---|---|
| DELETE policy on `picks` for commissioner | P0 | Missing |
| Storage bucket `league-assets` | P1 | Missing |
| `teams` extended fields (short_name, tts_name, autodraft, pre_draft_notes, owner_name, owner_photo_url, last_season_*) | P2 | Missing |
| `league_members.archived_at` | P2 | Missing |
| `league_season_members` snapshot table | P2 | Missing |
| `player_rankings` table | P2 | Missing |
| Rename `use_whammies` → `use_landmines`, `whammy_count` → `landmine_count` | P2 | Missing |
| `drafts.landmine_player_ids uuid[]` | P2 | Missing |
| `teams.walk_up_song_url text` | P2 | Missing |
