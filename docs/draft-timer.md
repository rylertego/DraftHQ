# Draft Timer

## Authority

PostgreSQL is authoritative for the draft clock. Active drafts store an
absolute `pick_deadline_at`; pause stores `paused_remaining_seconds`; resume
creates a new deadline from the stored remainder. Every completed pick creates
the next deadline atomically with advancing `current_pick`.

Clients call `get_draft_server_time` when loading an authoritative room
snapshot. DraftHQ estimates the network midpoint and uses the resulting clock
offset when displaying the shared deadline. Client interval timing affects only
rendering and never draft eligibility or state.

Start, pause, resume, and timer configuration RPCs return the updated draft.
The initiating client applies that result immediately and then reconciles with
a full snapshot and Realtime updates.

## MVP Expiration Policy

DraftHQ uses a soft expiration:

* At zero, the current team remains on the clock.
* The assigned owner may still make the pick.
* DraftHQ does not auto-select a player or skip the team.
* The commissioner may use Recovery Pick, pause the draft, or contact the owner.
* A successful pick advances the draft and starts the next team's full clock.

This policy avoids making an irreversible roster decision without an explicit
league rule. Auto-pick can be added later as a separately configured,
PostgreSQL-enforced strategy.
