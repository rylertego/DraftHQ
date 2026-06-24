# DraftHQ Roadmap

## Phase 1 - Reliable Multiplayer Draft Room (Core Complete)
- Supabase multiplayer
- Realtime picks
- Join codes/links
- Team assignment
- Player search
- Commissioner controls
- Timer
- Initial responsive mobile support

## Phase 2 - Sleeper Import (Complete)
- Import league
- Import teams
- Import managers
- Import draft order
- Import settings

## Phase 3 / Milestone 4A - League-Ready Draft Operations and Mobile RC (Active)
- Automated Supabase migration and RPC coverage
- Mobile browser validation
- Multi-device end-to-end testing
- Reconnect and recovery testing
- Timer reliability validation
- Commissioner recovery runbooks
- Observability and telemetry plan
- Controlled full-draft rehearsal plan

This phase completes the release-readiness work for the draft-first product.
Visual identity and presentation work begins only after these gates pass.

## Phase 4 / Milestone 4B - League Identity Layer
- `leagues`, `league_members`, `league_teams` schema (additive, nullable FKs)
- League creation flow
- League settings: branding (logo, banner, colors, theme)
- League settings: members and roles
- Draft room inherits league colors and logo when league-scoped
- Team logos in draft board pick cells
- Better on-the-clock presentation
- TV/broadcast mode (`/leagues/[slug]/broadcast`)

See [docs/league-first-architecture.md](league-first-architecture.md) for the full
data model and URL structure for this phase and beyond.

## Phase 5 - League Workspace
- `league_seasons`, `league_team_seasons` schema
- User dashboard at `/dashboard` (all leagues, recent activity)
- League home, members directory, seasons index
- Season detail with read-only draft archive
- Season creation flow (replaces standalone create for league commissioners)
- Basic history page (champions list)
- Standalone `/create` continues to work for non-league drafts

> **TODO (before Phase 6):** Season archiving. When a new season is created, the commissioner should be prompted (or the system should automatically set) the previous season's status to `complete`. Past seasons currently appear on the league home under "Past Seasons" but there is no explicit archive/close flow. Need a commissioner action (or end-of-draft trigger) that marks a season complete and prevents further picks. Also need a `league_season_members` snapshot so past-season member counts are correct rather than reflecting current membership.

> **TODO (before Phase 6):** Roster position filtering in the player pool. When a commissioner unchecks a position in Roster Positions (e.g. Kickers), players of that position should be hidden from the draft room player pool. The `roster_positions` JSONB column on `drafts` is already set; the draft room player list query (and/or client-side filter) needs to read the enabled positions and exclude any `PlayerPosition` not represented. DST is a special case — disabling Defense / ST should remove team defenses from the pool, not individual defensive players (those are controlled by the IDP row).

## Phase 6 - Player Rankings
Player rankings power the draft room player board sort order and are scoped per scoring type.

**Scoring types** (already stored as `scoring_type` on `drafts`): Standard, PPR, Half-PPR, Superflex.

**Implementation:**
- Source rankings data (e.g. FantasyPros consensus, or manually curated) and store in a `player_rankings` table: `(player_id, scoring_type, rank, tier)`
- Draft room player board sorts by rank for the active scoring type by default
- Owners can re-sort by position, name, or ADP
- Commissioner can upload a custom rankings CSV to override defaults for their league (stored in a `league_player_rankings` table scoped to `league_id`)
- `hide_player_rankings` flag (already on `drafts`) hides rank column and forces alphabetical sort — implement once base rankings are live

## Phase 7 - Records, Hall of Fame, and Reports
- Records page (computed from picks and seasons data)
- Hall of Fame page and commissioner management
- Draft analytics on season detail (fastest drafter, position trends)
- In-app draft results page (replaces CSV-only export)
- Downloadable report formats

## Phase 7 - Broadcast Mode and Media
- Walk-up songs per team (Spotify embed, YouTube)
- Sound effects (opt-in per league)
- Pick reveal animations in broadcast mode
- Player highlight video support

## Phase 8 - Landmine Mode
A commissioner-enabled "mystery penalty" feature for party-style leagues.

**How it works:**
- Commissioner enables Landmine Mode in draft settings and selects a count (1–30)
- When the draft starts (or resets), the system randomly assigns N players from the top 150 eligible players as "Landmines" — stored server-side, hidden from all owners
- Players with keeper status or an assigned video are excluded from eligibility
- When a Landmine player is drafted, a fullscreen reveal animation/video fires in the draft room announcing the pick as a Landmine — the owner is penalized per league rules (e.g. "take a shot")
- **Commissioner reveal tool**: a "Reveal Landmine Players" button appears in settings after the draft starts, so the commissioner can preview the assigned Landmines for a test run
- Changing the Landmine count or resetting the draft re-randomizes the assignments

**Implementation notes:**
- Settings fields (`use_landmines`, `landmine_count`) are already on the `drafts` table (currently named `use_whammies`/`whammy_count` — rename before launch)
- Need a `landmine_player_ids uuid[]` column on `drafts` to store the assigned player IDs
- Assignment logic runs server-side (Supabase function or API route) on draft start/reset
- Draft room listens for picks matching `landmine_player_ids` and triggers the reveal UI
