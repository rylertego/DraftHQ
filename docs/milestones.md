# DraftHQ Milestones

## Milestone 1 - Local MVP
Status: Complete

## Milestone 2 - Multiplayer Draft Room
Status: Complete

Goal: Multiple owners can join and draft from phones/laptops.

## Milestone 3 - Live Draft Reliability
Status: Complete

Goal: Refresh, reconnect, timer, undo, and wrong-owner protection are stable.

## Milestone 4A - League-Ready Draft Operations and Mobile RC
Status: Active

Goal: Turn the reliable draft room into a production-ready release candidate
that is validated across mobile browsers, devices, and realistic full drafts.

- Automated Supabase migration and RPC coverage
- Mobile browser validation
- Multi-device end-to-end testing
- Reconnect and recovery testing
- Timer reliability validation
- Commissioner recovery runbooks
- Observability and telemetry plan
- Controlled full-draft rehearsal plan

Milestone 4A is a release-readiness milestone. It does not include league
branding, entertainment features, or league history.

## Milestone 4B - League Identity Layer
Status: Planned

Goal: Introduce the persistent league data model and surface league branding in the
draft room and a new league settings area. This is the foundation for all future
league-first features. No seasons, history, or records in this milestone.

Schema additions (additive only, nullable FKs, existing drafts unaffected):
- `leagues` table with branding fields (logo, banner, colors, theme)
- `league_members` table (persistent membership)
- `league_teams` table (persistent franchises)
- Nullable `league_id` on `drafts`

Product:
- League creation flow
- League settings: profile, branding, members and roles
- Draft room inherits league colors and logo when league-scoped
- Team logos in draft board pick cells when configured
- Better on-the-clock presentation
- TV/broadcast mode (`/leagues/[slug]/broadcast`, read-only, public)

See [docs/league-first-architecture.md](league-first-architecture.md) for the full
data model, URL structure, settings hierarchy, and phased migration plan.

## Milestone 5 - League Workspace
Status: Future

Goal: Persistent seasons and a full league workspace. Commissioners can create a
season, link it to a draft, and access history after the season ends.

Schema additions:
- `league_seasons` table
- `league_team_seasons` table

Product:
- User dashboard at `/dashboard`
- League home, members directory, seasons index
- Season creation flow (replaces standalone create for league commissioners)
- Season detail page with read-only draft archive
- Basic history page (champions list by year)
- Standalone `/create` continues to work for non-league drafts

## Milestone 6 - Records, Hall of Fame, and Reports
Status: Future

Goal: Complete the league identity platform with historical records, commissioner-curated
recognition, and in-app draft results.

- Records page (computed from picks and seasons data, no separate table required)
- Hall of Fame page and commissioner management (`league_hall_of_fame` table)
- Draft analytics: fastest drafter, position trends, biggest steals (planned ADP source)
- In-app draft results page with team rosters (replaces CSV-only export)
- Downloadable report formats

## Milestone 7 - Broadcast Mode and Media
Status: Future

Goal: Make draft night feel like an event through presentation, audio, and media features.

- Walk-up songs per team (Spotify embed or YouTube URL)
- Sound effects opt-in per league
- Pick reveal animations in broadcast mode
- Player highlight video support
