# DraftHQ Roadmap

## Target

Ship a private, invite-only DraftHQ release for a 10-12 person league by
September 5, 2026.

Success means the league can complete its draft in DraftHQ without needing
FanDraft.

## Phase 1: Core Draft Foundation

Status: substantially implemented

* Draft creation and team setup
* Supabase shared state
* Atomic draft operations in PostgreSQL
* Snake draft board
* Player catalog
* Realtime picks
* Drafted-player protection
* Recent picks and undo
* Persistent accounts and owner profiles
* Invite-only owner access and team claims

## Phase 2: Reliability And Ownership

Priority: current

* Harden reconnect and session recovery behavior
* Verify team ownership on multiple devices
* Improve commissioner participant and team management
* Add draft lifecycle controls such as start, pause, resume, and completion
* Add timer behavior only if it can be made operationally reliable
* Improve error states and recovery guidance
* Expand multiplayer and authorization test coverage
* Test the complete flow on phones, laptops, and a shared display

## Phase 3: Sleeper Import

Priority: required before the September 5 draft

* Connect a private league to Sleeper
* Import league settings needed by DraftHQ
* Import teams and managers
* Import draft order
* Map imported owners to DraftHQ participants
* Validate imported data and allow commissioner corrections

Full bidirectional synchronization is not required for the private milestone
unless the league's draft workflow proves that it is necessary.

## Phase 4: Draft-Day Readiness

Priority: required before September 5

* Run full mock drafts with 10-12 participants
* Test simultaneous picks and stale clients
* Test disconnects, refreshes, and device switching
* Verify commissioner recovery procedures
* Confirm player catalog freshness before draft day
* Prepare deployment, monitoring, backup, and rollback steps
* Freeze nonessential features before the real draft

## Phase 5: League And Team Customization

Priority: after the September 5 milestone

* League logo, colors, background, theme, and landing page
* Team logo, colors, banner, and walk-up song
* League-specific owner and team presentation

## Phase 6: Draft-Night Presentation

Priority: future

* Broadcast and TV mode
* Draft ticker and presentation screens
* Pick animations and team introductions
* Spotify and YouTube integrations
* Walk-up songs, playlists, and sound cues
* Advanced themes

## Phase 7: Advanced Platform Features

Priority: future

* AI draft assistance
* Keeper, dynasty, and auction formats
* Draft history and analytics
* Public product and multi-league expansion

Music, themes, animations, AI, public launch work, and broad FanDraft feature
parity must not delay the private September 5 draft.
