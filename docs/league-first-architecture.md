# DraftHQ — League-First Architecture

## Summary

DraftHQ's current model is draft-scoped: every entity (team, participant, pick) belongs to
one draft. The league-first architecture adds a persistent layer above drafts so that teams,
members, and history survive across seasons.

The transition is additive, not a replacement. Standalone drafts continue working unchanged.
The league layer wraps above them, giving teams and members persistent identity. The draft
room gains context from the league that contains it but its core contract does not change.

---

## The Structural Problem

Current hierarchy:

```
Draft
  └── Teams         (draft-scoped, destroyed with draft)
  └── Participants  (draft-scoped, destroyed with draft)
  └── Picks
```

League-first hierarchy:

```
League
  └── League Members      (persistent users)
  └── League Teams        (persistent franchises across seasons)
  └── Seasons             (one per calendar year)
        └── Draft         (the existing draft, now season-scoped)
        └── League Team Seasons  (team + owner for this year)
              └── Picks   (unchanged)
```

Existing `drafts`, `teams`, `picks`, and `draft_participants` tables are preserved unchanged.
New tables add the persistent layer above them. Foreign keys on existing tables are nullable
so a draft without a league remains fully functional.

---

## Data Architecture

### New Tables

#### `leagues`

The persistent container for a league. Holds identity, branding, and commissioner ownership.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique | URL-friendly, e.g. `monday-night-mayhem` |
| `name` | text | Display name |
| `commissioner_user_id` | uuid → auth.users | |
| `description` | text nullable | |
| `established_year` | integer nullable | |
| `logo_url` | text nullable | |
| `banner_url` | text nullable | |
| `primary_color` | text nullable | Hex value |
| `secondary_color` | text nullable | Hex value |
| `accent_color` | text nullable | Hex value |
| `theme` | text | `classic`, `broadcast`, `dark`, `modern` |
| `sleeper_league_id` | text nullable | For Sleeper-linked leagues |
| `created_at`, `updated_at` | timestamptz | |

---

#### `league_members`

Persistent membership in a league. Replaces ephemeral `draft_participants` for league context.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `league_id` | uuid → leagues | CASCADE |
| `user_id` | uuid → auth.users | CASCADE |
| `role` | text | `commissioner`, `owner`, `viewer` |
| `display_name` | text | League-scoped display name |
| `joined_at` | timestamptz | |
| Unique | `(league_id, user_id)` | |

---

#### `league_teams`

A franchise that persists across all seasons. Its owner can change year to year.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `league_id` | uuid → leagues | CASCADE |
| `name` | text | The franchise name |
| `logo_url` | text nullable | |
| `banner_url` | text nullable | |
| `primary_color` | text nullable | |
| `secondary_color` | text nullable | |
| `description` | text nullable | |
| `founded_year` | integer nullable | |
| `created_at`, `updated_at` | timestamptz | |

---

#### `league_seasons`

One season per calendar year per league. Links a persistent league to a specific draft.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `league_id` | uuid → leagues | CASCADE |
| `year` | integer | |
| `name` | text | e.g. `2025 Season` |
| `status` | text | `upcoming`, `drafting`, `active`, `complete` |
| `draft_id` | uuid → drafts nullable | The linked draft |
| `sleeper_league_id` | text nullable | Year-specific Sleeper binding |
| `sleeper_season` | text nullable | |
| `champion_team_id` | uuid → league_teams nullable | Set at season end |
| Unique | `(league_id, year)` | |

---

#### `league_team_seasons`

A team's participation in a given season: who owns it, draft position, final result.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `league_season_id` | uuid → league_seasons | CASCADE |
| `league_team_id` | uuid → league_teams | |
| `owner_user_id` | uuid → auth.users nullable | Who owned it this year |
| `draft_position` | integer | Snake draft pick order for this season |
| `draft_team_id` | uuid → teams nullable | Links to the draft-scoped team instance |
| `sleeper_roster_id` | integer nullable | |
| `final_standing` | integer nullable | Set at season end |
| Unique | `(league_season_id, league_team_id)` | |

---

#### `league_hall_of_fame`

Commissioner-curated inductees. Public-readable.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `league_id` | uuid → leagues | CASCADE |
| `user_id` | uuid → auth.users | The inducted member |
| `inducted_year` | integer | |
| `blurb` | text nullable | Commissioner's write-up |
| Unique | `(league_id, user_id)` | |

---

### Modified Existing Tables

These are additive changes — nullable foreign keys only. No existing columns removed.

- `drafts`: add `league_season_id uuid nullable → league_seasons`
- `teams`: add `league_team_id uuid nullable → league_teams`
- `draft_participants`: add `league_member_id uuid nullable → league_members`

A draft with `league_season_id = null` is a standalone draft and behaves exactly as today.

---

## URL Structure

```
/                                  Landing
/dashboard                         User dashboard — all leagues + recent activity

/leagues/new                       Create a league
/leagues/[slug]                    League home
/leagues/[slug]/members            Owner and member directory
/leagues/[slug]/seasons            All seasons index
/leagues/[slug]/seasons/[year]     Season detail and draft archive
/leagues/[slug]/history            Champions and year-by-year summary
/leagues/[slug]/records            All-time record book
/leagues/[slug]/hall-of-fame       Hall of Fame (public, no auth required)
/leagues/[slug]/broadcast          TV/broadcast mode (public, no auth required)
/leagues/[slug]/settings           League settings hub
/leagues/[slug]/settings/branding
/leagues/[slug]/settings/members
/leagues/[slug]/settings/draft
/leagues/[slug]/settings/integrations

/draft?draftId=[id]                Draft room (unchanged — standalone or league-scoped)
/create                            Create standalone draft or start a new league
/join/[code]                       Join a draft (unchanged)
/profile                           User profile
/profile/history                   Personal draft history across all leagues
```

---

## Navigation Structure

### Global Nav

```
[DraftHQ logo]    [Dashboard]    [Profile]    [Notifications°]
```

Minimal. The league workspace has its own sub-navigation.

### League Workspace Sub-Nav

```
[League Logo + Name]
─────────────────────────────────────────────────────────
Home  |  Members  |  Seasons  |  History  |  Records  |  Hall of Fame
                                                        [Settings ⚙]  ← commissioner only
```

The league header (logo, banner, brand colors) renders at the top of every page within
`/leagues/[slug]/`. On mobile: horizontal scroll or collapsed under a league-branded header.

---

## User Dashboard

The dashboard is the default screen after login. It is a workspace index, not a landing page.

**Desktop:** Left rail for league list. Main area for selected league's activity or a unified
feed across all leagues.

**Mobile:** Stacked league cards with status indicators, then a unified recent activity list.

### League Card States

- `Draft active now` — green border, "Enter Draft Room" CTA
- `Draft scheduled` — date and countdown
- `Season active` — current week (if Sleeper-connected)
- `Offseason` — last champion, next draft TBD

---

## League Workspace Pages

### League Home (`/leagues/[slug]`)

1. **League header** — Logo, banner, name, established year, description.
2. **Status banner** — Context-aware: draft countdown, live draft CTA, season status, off-season.
3. **Current/upcoming season card** — Year, draft date, participant count, format.
4. **Recent champions strip** — Last 3–5 seasons with winning team logo and owner name.
5. **Activity feed** (members-only) — Recent picks, commissioner announcements.
6. **Quick stats** — Total seasons, total members, most-decorated owner.

### Members (`/leagues/[slug]/members`)

Per-member card: avatar, display name, current team name and logo, championships count,
seasons participated, commissioner badge. Sorted by championships desc, then years active.

### Seasons (`/leagues/[slug]/seasons`)

Timeline of all seasons, most recent first. Per row: year, champion, draft date, format,
status badge, link to season detail.

### Season Detail (`/leagues/[slug]/seasons/[year]`)

1. **Season header** — Year, status, champion if complete.
2. **Draft archive** — Read-only draft board using the existing `DraftBoard` component,
   populated from archived picks. Team logos appear when available.
3. **Team rosters** — Each team's picks by round: player name, position, NFL team.
4. **Standings** — Final record and playoff result if Sleeper-connected.
5. **Season stats** — Fastest pick, slowest pick, position distribution.

### History (`/leagues/[slug]/history`)

Year-by-year table: year, season name, champion, runner-up, draft format, total picks.
Below the table: most-championship owners highlight (top 3 with career counts).

### Records (`/leagues/[slug]/records`)

Computed from picks and seasons data. No separate table required for MVP.

Categories:
- **Championships** — Most titles, back-to-back, longest drought
- **Draft picks** — Earliest QB taken, most RBs in first 3 rounds by year
- **Draft speed** — Fastest/slowest average pick time (requires `picks.created_at` vs. deadline)
- **Participation** — Most seasons, most consecutive seasons
- **Position trends** — First WR/QB taken by year, shown as a chart over time

### Hall of Fame (`/leagues/[slug]/hall-of-fame`)

Commissioner-curated. Public (no auth required, shareable link).

Per inductee card: owner photo, display name, induction year, championships during tenure,
commissioner's write-up. Ordered by induction year. Manages via league settings.

---

## Broadcast Mode (`/leagues/[slug]/broadcast`)

A separate full-screen route. No authentication required. Designed for TV projection or
screensharing during draft night.

```
┌──────────────────────────────────────────────────────────┐
│  [League Logo]      MONDAY NIGHT MAYHEM         [Clock]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│               ON THE CLOCK                               │
│           [Team Logo — large]                            │
│         Mountain Monsters                                │
│       Round 3 · Pick 27 of 180                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ← Ja'Marr Chase WR · Steel Curtain · Pick 26  ←        │
└──────────────────────────────────────────────────────────┘
```

Behavior:
- Supabase Realtime subscription to the active draft (read-only, no mutations)
- League brand colors applied as CSS custom properties
- Team logos appear when configured
- Pick ticker scrolls horizontally; new picks animate in
- Timer shown prominently, pulses at ≤15s
- No commissioner controls visible
- Walk-up music plays on this screen when configured (Phase 7)

---

## Settings Architecture

### League Settings (`/leagues/[slug]/settings`)

Commissioner only. Sub-navigation in left rail:

**Profile**
- League name, description, established year, website URL
- Visibility: members-only vs. public

**Branding**
- Logo upload, banner upload
- Primary, secondary, accent color pickers
- Theme selection: Classic, Broadcast, Dark, Modern
- Live preview of league workspace with selected settings

**Members & Roles**
- All `league_members` with role badges
- Change role: owner ↔ viewer
- Remove member (historical `league_team_seasons` records preserved)
- Transfer commissioner role (requires confirmation)
- Pending invitations

**Draft Defaults**
- Default format: Snake (Auction and Hybrid planned)
- Default rounds, pick timer, autodraft behavior
- Applied when creating a new season's draft

**Integrations**
- Sleeper: connect league ID, sync status, last-synced date, resync button
- Future: ESPN, Yahoo connectors

**Danger Zone**
- Archive league (hides from dashboard, preserves all data)
- Delete league (requires typing the league name)
- Transfer league ownership

---

### Team Settings

Accessible by the owner of that team, or by the commissioner for any team.

**Identity**
- Team name, logo upload, banner upload
- Primary and secondary color
- Team description (280 chars), founded year

**Owner Profile**
- League-scoped display name override
- Avatar (inherits from `profiles.avatar_url` unless overridden)

**Draft Preferences**
- Walk-up song: Spotify track URL or YouTube URL
- Pre-draft notes (visible to commissioner and owner only)
- Autodraft ranking order (planned)

**Commissioner additions (any team)**
- Reassign team to a different league member
- Reset team branding to defaults

---

### Member/Owner Settings

**My Profile (`/profile`)**
- Display name (global default), avatar, bio (280 chars)
- Email (read-only from auth)
- Linked accounts: Sleeper username

**My Leagues (`/profile`)**
- All leagues with role badge
- Leave league option (removes `league_member`, preserves history)

**Notifications (planned)**
- Draft start reminders, your-pick-is-up alerts
- Commissioner announcements
- Draft results published

---

## Draft Management within a League

### Commissioner: Start a New Season

1. Go to `/leagues/[slug]/seasons` → "New Season"
2. Choose year (defaults to current year)
3. Create draft manually or import from Sleeper
4. If Sleeper: pulls teams, rosters, managers, draft order for this year
5. Map Sleeper teams → League Teams (smart match by name/owner; commissioner confirms)
6. Draft settings pre-filled from league defaults (format, rounds, timer)
7. Generate join code → same invitation flow as today
8. Save → creates `league_season` + `draft` records linked together

### Active Draft within a League

The draft room at `/draft?draftId=[id]` gains:
- League header (logo, name, brand colors) instead of just the draft name
- Team logos in pick cells when configured
- "Back to League" link
- Broadcast mode link for commissioner to share

No behavioral change. The existing RPC contract is untouched.

### After Draft Completes

- Commissioner sees "Publish Season Results" button
- Marks `league_season.status` as `active` (regular season begins)
- Draft board archived at `/leagues/[slug]/seasons/[year]`
- Champion set at season end via league settings → `league_seasons.champion_team_id`

---

## Future Feature Placement

| Feature | Route / Location | What Enables It |
|---|---|---|
| League branding | All workspace pages + draft room | `leagues` branding fields + CSS custom properties |
| Team logos in draft room | Pick cells in `DraftBoard` | `league_teams.logo_url` via `league_team_seasons` |
| TV/Broadcast mode | `/leagues/[slug]/broadcast` | Realtime read-only subscription, league CSS variables |
| Walk-up songs | Draft room + broadcast mode | `league_team_seasons.walk_up_song_url` + Web Audio/Spotify embed |
| Hall of Fame | `/leagues/[slug]/hall-of-fame` | `league_hall_of_fame` table, commissioner-managed |
| History | `/leagues/[slug]/history` | `league_seasons` + `champion_team_id` |
| Records | `/leagues/[slug]/records` | Computed from `picks` + `league_team_seasons` |
| Draft analytics | Season detail page | Picks data + ADP source (planned) |
| Player videos | Pick modal, broadcast mode | `players.media_url` column or commissioner-managed links |
| Spotify integration | Team settings → walk-up song | Spotify track ID stored in `league_teams` |
| Auction drafts | New season → draft format | New RPC, `picks.bid_amount` column when format = `auction` |
| Dynasty/Keeper | `league_seasons` + keeper rules | `league_team_seasons.keeper_player_ids` (planned) |
| Commissioner announcements | League home activity feed | `league_announcements` table |
| Push notifications | Draft start, pick alerts | Supabase Edge Functions + push service |
| AI draft recommendations | Pick modal | Separate inference service reading ADP + positional scarcity |

---

## Migration Path

### Phase 4A (current) — Draft-First Stabilization

No schema changes. Ship the reliable draft room validated across mobile browsers,
real devices, and full-draft rehearsals.

### Phase 4B — League Identity Layer

- Add `leagues`, `league_members`, `league_teams` tables with RLS
- Add nullable `league_id` to `drafts` (backward compatible)
- League settings UI: branding, members
- Draft room inherits league colors when `draft.league_id` is set
- Team logos in draft room when league teams have branding
- No seasons, no history yet

### Phase 5 — League Workspace

- Add `league_seasons`, `league_team_seasons` tables
- Season creation flow (replaces standalone create for league commissioners)
- User dashboard at `/dashboard`
- League home, members, seasons index, season detail
- Basic history page (champions list)
- Standalone `/create` still works for non-league drafts

### Phase 6 — Records, Hall of Fame, Reports

- Records page (computed queries from existing data)
- Hall of Fame page and commissioner management
- Draft analytics on season detail pages
- In-app draft results page (replaces CSV-only export)
- Downloadable report formats

### Phase 7 — Broadcast Mode and Media

- `/leagues/[slug]/broadcast` route
- Walk-up song support in team settings
- Spotify embed integration
- Sound effects (opt-in per league)
- Pick reveal animations in broadcast mode

---

## What Does Not Change

- `drafts`, `teams`, `picks`, `players`, `draft_participants` table structures unchanged
- All existing RPCs (`make_pick`, `start_draft`, `undo_pick`, etc.) unchanged
- Draft room component and URL stay the same
- Standalone drafts (no league) continue to work for one-off use
- RLS patterns extend to new tables using the same member-check approach

The league layer is strictly additive. Existing drafts are not broken, orphaned, or migrated.
A draft without a `league_season_id` behaves exactly as it does today.
