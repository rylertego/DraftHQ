# DraftHQ Milestones

## Private League Draft: September 2, 2026

### Milestone Question

> Can my league complete its September 2 draft in DraftHQ without needing
> FanDraft?

### Audience

* One private, invite-only fantasy football league
* 10-12 owners
* Commissioner, owner, and shared-display use
* Phones and laptops on typical home or venue networks

### Required Outcome

The commissioner can create the draft, invite owners, assign teams, run the
draft, recover from common mistakes, and finish with a complete, persistent
record of every pick.

Owners can join from their own devices, see the same draft state in real time,
and make a pick only when their team is on the clock.

### Acceptance Criteria

* A persistent commissioner account can create and configure the draft.
* Owners can accept private invitations and claim their assigned teams.
* All connected clients receive picks and draft-state changes in real time.
* PostgreSQL prevents out-of-turn picks and duplicate drafted players.
* Refreshing, reconnecting, or switching devices restores authoritative state.
* Drafted players cannot be selected again.
* The draft timer is visible, accurate, and controlled by the draft lifecycle.
* The commissioner can control or recover the draft and undo the latest pick.
* The player catalog is current and searchable on draft day.
* Owners can search for and select players from their phones.
* The draft board is usable on owner phones and commissioner laptops.
* A full 10-12 owner mock draft completes without state divergence or manual
  database repair.
* The production deployment has documented monitoring, backup, and recovery
  steps.

### High-Priority Stretch Goals

* Sleeper import for league, team, manager, and draft-order setup
* League logo and league colors
* Team logos
* Basic draft room themes

### Lower-Priority Stretch Goals

* Spotify and YouTube integrations
* Walk-up songs
* Pick announcement sounds
* Broadcast and TV mode polish

### Not Required For This Milestone

* Public registration or league discovery
* Full FanDraft feature parity
* Broadcast animations or advanced TV presentation
* AI recommendations or analysis
* Auction, keeper, or dynasty formats

### Readiness Gates

1. Core flows pass automated unit and multiplayer tests.
2. At least one full internal mock draft succeeds with representative devices.
3. A 10-12 owner rehearsal succeeds under real network conditions.
4. Critical defects are fixed and nonessential feature work is frozen.
5. Commissioner recovery procedures are rehearsed before September 2.

### Future Milestones

After the private draft succeeds, future milestones can add league and team
customization, richer Sleeper synchronization, broadcast mode, Spotify,
YouTube, walk-up songs, themes, animations, AI, and broader product access.
