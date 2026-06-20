# DraftHQ Product Vision

## Product Goal

DraftHQ is a multiplayer fantasy football draft room built for a reliable,
shared draft-night experience across phones, laptops, and a presentation
screen.

The immediate goal is not to replace every FanDraft feature. By September 5,
2026, DraftHQ should be dependable enough for a private 10-12 person fantasy
football league to complete its real draft without needing FanDraft.

## Initial Audience

DraftHQ will begin as a private, invite-only product for the creator's league.
Public registration, broad league discovery, monetization, and multi-tenant
growth are outside the September 5 milestone.

Starting privately allows development and testing to focus on draft correctness,
realtime reliability, and the needs of one known league before considering a
public launch.

## September 5 Product

The core product is a multiplayer fantasy draft room with:

* Supabase-backed shared draft state
* Realtime picks across connected devices
* Commissioner-created drafts
* Invite-only owner access
* Team ownership and assignment
* Enforced on-the-clock permissions
* A reliable player database
* Drafted-player protection
* Snake draft ordering
* Commissioner controls, including undo
* Reconnection and draft persistence
* Usable phone, laptop, and shared-screen layouts
* Sleeper league import for essential league setup data

The milestone question is:

> Can my league complete its September 5 draft in DraftHQ without needing
> FanDraft?

## Current Priorities

Work should be prioritized in this order:

1. Supabase multiplayer reliability
2. Draft correctness and realtime picks
3. Team ownership and invite flows
4. Player database quality
5. Commissioner controls and recovery tools
6. Sleeper import
7. Draft-day usability and operational testing

Features that do not directly improve the September 5 draft should not displace
these priorities.

## Long-Term Vision

After the private-league milestone is reliable, DraftHQ can grow into a custom
draft-night platform that feels more like a live sports broadcast than a
spreadsheet.

Long-term capabilities may include:

* Sleeper integration and synchronization
* Spotify integration
* YouTube integration
* Team walk-up songs
* League-specific customization
* Team customization
* Broadcast and TV draft modes
* Presentation themes and animations
* AI-assisted draft features

These are future phases, not requirements for the September 5 release.

## League Customization

Future league-level customization should support:

* League logo
* Custom colors
* Background image
* Draft room theme
* League landing page

## Team Customization

Future team-level customization should support:

* Team logo
* Team colors
* Team banner
* Walk-up song

League and team customization should remain separate from permanent user
profiles so the same owner can have a different identity in each league.

## Product Principles

* Reliability before spectacle
* PostgreSQL-enforced draft correctness
* Realtime behavior that survives reconnects and multiple devices
* Commissioner recovery controls for live-draft problems
* Original DraftHQ branding and presentation
* Small, testable phases rather than a full FanDraft clone at launch

Music, themes, animations, AI, and advanced presentation work begin only after
the core private-league draft is dependable.
