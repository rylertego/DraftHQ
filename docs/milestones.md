# DraftHQ Milestones

## Private League Draft: September 5, 2026

### Milestone Question

> Can my league complete its September 5 draft in DraftHQ without needing
> FanDraft?

### Audience

* One private, invite-only fantasy football league
* 10-12 owners
* Commissioner, owner, and shared-display use
* Phones and laptops on typical home or venue networks

### Required Outcome

The commissioner can create or import the league, invite owners, assign teams,
run the draft, recover from common mistakes, and finish with a complete,
persistent record of every pick.

Owners can join from their own devices, see the same draft state in real time,
and make a pick only when their team is on the clock.

### Acceptance Criteria

* A persistent commissioner account can create and configure the draft.
* Owners can accept private invitations and claim their assigned teams.
* Sleeper can supply the league, team, manager, and draft-order data required
  for setup, with commissioner correction when imported data is incomplete.
* All connected clients receive picks and draft-state changes in real time.
* PostgreSQL prevents out-of-turn picks and duplicate drafted players.
* Refreshing, reconnecting, or switching devices restores authoritative state.
* Drafted players cannot be selected again.
* The commissioner can pause or recover the draft and undo the latest pick.
* The player catalog is current and searchable on draft day.
* The draft board is usable on owner phones, commissioner laptops, and a shared
  display.
* A full 10-12 owner mock draft completes without state divergence or manual
  database repair.
* The production deployment has documented monitoring, backup, and recovery
  steps.

### Not Required For This Milestone

* Public registration or league discovery
* Full FanDraft feature parity
* Spotify or YouTube integrations
* Walk-up songs or draft playlists
* League or team visual customization
* Broadcast animations or advanced TV presentation
* AI recommendations or analysis
* Auction, keeper, or dynasty formats

### Readiness Gates

1. Core flows pass automated unit and multiplayer tests.
2. At least one full internal mock draft succeeds with representative devices.
3. A 10-12 owner rehearsal succeeds under real network conditions.
4. Critical defects are fixed and nonessential feature work is frozen.
5. Commissioner recovery procedures are rehearsed before September 5.

### Future Milestones

After the private draft succeeds, future milestones can add league and team
customization, richer Sleeper synchronization, broadcast mode, Spotify,
YouTube, walk-up songs, themes, animations, AI, and broader product access.
