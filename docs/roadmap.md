# DraftHQ Roadmap

## Target

Ship a private, invite-only DraftHQ release for a 10-12 person league by
September 2, 2026, before the commissioner leaves.

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
* Add a reliable draft timer
* Improve error states and recovery guidance
* Expand multiplayer and authorization test coverage
* Test the complete flow on phones, laptops, and a shared display

## Phase 3: Required Draft-Day Workflow

Priority: required before September 2

* Confirm join codes and links work across devices
* Confirm team assignment and on-the-clock ownership
* Keep the player database current and searchable
* Complete draft timer and commissioner controls
* Verify undo, persistence, and recovery behavior
* Make owner drafting usable on mobile devices

## Phase 4: High-Priority Stretch Goals

Priority: attempt before September 2 only after required workflow is reliable

* Connect a private league to Sleeper
* Import league settings needed by DraftHQ
* Import teams and managers
* Import draft order
* Map imported owners to DraftHQ participants
* Validate imported data and allow commissioner corrections
* Add a league logo and league colors
* Add team logos
* Add basic draft room themes

Full bidirectional synchronization is not required for the private milestone
unless the league's draft workflow proves that it is necessary.

## Phase 5: Draft-Day Readiness

Priority: required before September 2

* Run full mock drafts with 10-12 participants
* Test simultaneous picks and stale clients
* Test disconnects, refreshes, and device switching
* Verify commissioner recovery procedures
* Confirm player catalog freshness before draft day
* Prepare deployment, monitoring, backup, and rollback steps
* Freeze nonessential features before the real draft

## Phase 6: League And Team Customization

Priority: after the September 2 milestone, beyond the basic stretch goals

* League logo, colors, background, theme, and landing page
* Team logo, colors, banner, and walk-up song
* League-specific owner and team presentation

## Phase 7: Draft-Night Presentation

Priority: future

* Broadcast and TV mode
* Draft ticker and presentation screens
* Pick animations and team introductions
* Spotify and YouTube integrations
* Walk-up songs, playlists, and sound cues
* Pick announcement sounds
* Advanced themes

## Phase 8: Advanced Platform Features

Priority: future

* AI draft assistance
* Keeper, dynasty, and auction formats
* Draft history and analytics
* Public product and multi-league expansion

Music, themes, animations, AI, public launch work, and broad FanDraft feature
parity must not delay the private September 2 draft.
