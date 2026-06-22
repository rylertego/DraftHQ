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

## Phase 6 - Records, Hall of Fame, and Reports
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
