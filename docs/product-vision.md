# DraftHQ - Product Vision

## Mission

DraftHQ is a fantasy sports draft and league experience platform that combines the functionality of league providers such as Sleeper with the presentation quality of FanDraft.

The goal is to make fantasy draft night feel like a live sports broadcast while giving every league its own identity, history, and home.

DraftHQ is not intended to replace Sleeper, ESPN, Yahoo, or other fantasy providers.

Instead:

* Sleeper manages the fantasy league.
* DraftHQ manages the draft experience, league identity, history, and presentation.

The product begins as draft-first and evolves into a league-first platform. The league-first
architecture is defined in [docs/league-first-architecture.md](league-first-architecture.md).

---

# Core Principles

## 1. Draft Correctness First

Nothing is more important than draft integrity.

DraftHQ must guarantee:

* Correct draft order
* Correct snake draft logic
* No duplicate player selections
* Realtime synchronization
* Team ownership enforcement
* Reliable commissioner controls
* Draft recovery after refresh or reconnect

Reliability always takes priority over visual features.

---

## 2. Every League Should Feel Unique

When a commissioner creates a league, it should feel like a dedicated home for that league.

Every league should have its own:

* Name
* Logo
* Colors
* Banner
* Theme
* History
* Records
* Owners
* Draft archive

The goal is for leagues to feel like communities rather than temporary draft rooms.

---

## 3. Draft Night Should Feel Like an Event

DraftHQ should feel closer to:

* NFL Draft
* NBA Draft
* Live sports broadcasts

And less like:

* Spreadsheets
* Generic fantasy tools
* Administrative software

The draft should feel exciting.

---

# MVP (Current Goal)

Target: League-ready by September 2

## Draft Creation

* Create draft
* Configure teams
* Configure rounds
* Generate join code
* Invite owners

## Multiplayer Drafting

* Realtime synchronization
* Mobile support
* Desktop support
* Team assignment
* Ownership validation
* Draft persistence

## Draft Experience

* Draft board
* Current pick display
* Recent picks
* Searchable player database
* Draft timer
* Commissioner controls
* Undo pick

## Sleeper Integration

* Import league
* Import teams
* Import managers
* Import draft order
* Import settings

---

# League Identity

Every league should have its own customizable profile.

## League Branding

Commissioners can configure:

* League name
* League logo
* League banner
* Primary color
* Secondary color
* Accent color
* League description
* Established year

## League Themes

Future support:

* Classic
* Broadcast
* Dark
* Modern
* Custom theme presets

All league pages inherit league branding.

---

# Team Identity

Each owner can personalize their team.

## Team Profile

Owners can edit:

* Team name
* Team logo
* Team banner
* Team colors
* Team description
* Owner photo
* Text-to-speech name
* Walk-up songs
* Pre-draft notes

## Permissions

Owner may edit:

* Their own team profile

Commissioner may edit:

* Any team
* Team assignments
* Draft settings
* Autodraft settings

---

# League Pages

Every league eventually receives a dedicated league hub.

## Home

League overview.

Includes:

* League branding
* Upcoming drafts
* Recent champions
* League announcements

## Owners

League member directory.

Includes:

* Owner profiles
* Team information
* League statistics

## History

Historical league information.

Includes:

* Champions
* Runner-ups
* Draft archives
* Historical standings

## Records

League record book.

Examples:

* Most championships
* Most points scored
* Longest win streak
* Highest scoring week
* Most playoff appearances

## Hall of Fame

Recognition page for league legends.

---

# Draft Presentation

The draft room should eventually support full presentation features.

## Draft Room Branding

* League colors
* Team colors
* Team logos
* League banner
* Draft overlays

## Broadcast Mode

Dedicated TV display.

Features:

* Full-screen board
* Draft ticker
* Current pick graphics
* Team spotlight
* Round transitions

## On-The-Clock Experience

* Team spotlight
* Team logo
* Team colors
* Walk-up music
* Pick timer
* Owner profile

---

# Audio Features

## Team Songs

Owners can configure:

* Walk-up songs
* Draft music
* Team playlists

Options:

* Play during pick
* Play during pre-draft
* Cycle by round

## Sound Effects

Custom sounds for:

* Draft start
* Pick submitted
* Pick revealed
* Timer warning
* Timer expiration
* Trade announcement

## Voice Reactions

Configurable:

* Positive reactions
* Negative reactions
* Announcer voice

Text-to-speech support for:

* Team names
* Pick announcements

---

# Video Features

## Pick Presentation

Optional:

* "The Pick Is In" sequence
* Pick reveal animations
* Team spotlight animations

## Player Videos

Support:

* Player highlight videos
* YouTube integration
* League-configured player media

---

# Reports

DraftHQ should generate downloadable reports.

## Draft Reports

* Draft summary
* Draft roster report
* Pick history
* Trade log
* Available player report

## Analytics

* Draft grades
* Biggest steals
* Biggest reaches
* Fastest drafter
* Slowest drafter
* Position trends

## Historical Reports

* Year-over-year drafts
* Owner trends
* League history

---

# Future Draft Types

## Supported Formats

* Snake Draft
* Auction Draft
* Hybrid Draft

## League Types

* Redraft
* Keeper
* Dynasty
* IDP

---

# Long-Term Vision

DraftHQ should become the place where fantasy leagues live.

A league should be able to:

1. Import from Sleeper.
2. Customize league branding.
3. Customize team identities.
4. Conduct live drafts.
5. View historical records.
6. Browse league history.
7. Run broadcast-style draft events.
8. Preserve league culture year after year.

The goal is not to replace Sleeper.

The goal is to become the best draft-night and league-identity platform available.

## League-First Architecture

The transition from draft-first to league-first adds a persistent layer above the existing
draft model. Leagues, seasons, and franchises persist across years. The draft room is unchanged
and gains league context when a draft belongs to a season.

Key principles:

* Standalone drafts continue working without any league.
* League teams and members persist across seasons; draft-scoped records do not.
* The draft room inherits league branding when league-scoped; otherwise it behaves as today.
* Broadcast mode, history, records, and Hall of Fame all live within the league workspace.

See [docs/league-first-architecture.md](league-first-architecture.md) for the full data model,
URL structure, navigation, settings hierarchy, and phased migration plan.
