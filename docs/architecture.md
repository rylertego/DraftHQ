# DraftHQ Architecture

## Architectural Priorities

DraftHQ is currently a draft-first application. The primary architectural goal
is a reliable multiplayer draft room. League identity and presentation build on
that foundation but do not override draft correctness.

The system follows these authority rules:

1. PostgreSQL is authoritative for draft state and draft correctness.
2. React renders state and submits user intent; it does not enforce core rules.
3. Supabase Realtime notifies clients about changes; it is not authoritative.
4. Clients recover by loading a fresh snapshot from PostgreSQL-backed APIs.

## Application Structure

DraftHQ is a Next.js application using React for the browser interface and
Supabase for authentication, PostgreSQL, and Realtime delivery.

The browser reads room data through the Supabase client. Sensitive server-only
operations, such as sending owner invitations and fetching authenticated
Sleeper previews, use Next.js route handlers. Secret or service-role credentials
must remain server-only and must never be exposed through `NEXT_PUBLIC_`
environment variables.

## PostgreSQL Authority

Security-definer PostgreSQL RPCs are the write boundary for draft operations.
They validate authentication and authorization, lock authoritative rows, apply
state transitions, and return or persist the resulting state atomically.

Authoritative operations include:

- Draft creation and Sleeper-based draft creation
- Joining a draft and claiming an invited team
- Team assignment and draft-order setup
- Starting, pausing, and resuming a draft
- Making owner and commissioner recovery picks
- Undoing the latest pick
- Removing or replacing participants during allowed draft states
- Configuring the pick timer

Database constraints provide additional protection for draft position, unique
team assignment, overall pick order, and duplicate player selections. Browser
clients do not receive direct table-write privileges for draft state.

Pick RPCs also require the caller's observed `current_pick`. After locking the
draft row, PostgreSQL rejects the request if the draft has advanced. This binds
the submitted intent to one draft slot and prevents queued concurrent requests
from silently applying to later picks.

## React Responsibilities

React displays the latest room snapshot, derives presentation state, and
enables or disables controls to provide immediate feedback. Client-side checks
are usability protections only. A stale, modified, or competing client cannot
be trusted to determine whether a pick or commissioner action is valid.

All correctness-sensitive decisions must remain enforced by PostgreSQL RPCs.
Local browser storage is not authoritative draft state.

## Realtime and Recovery

Supabase Realtime subscriptions notify connected clients when drafts, teams,
participants, invitations, or picks change. A notification prompts the client
to reconcile with an authoritative snapshot.

Realtime delivery is treated as lossy synchronization rather than a transaction
log. The client also refreshes after local mutations, when a subscription is
established, when connectivity or focus returns, and when periodic revision
checks detect newer draft state. Picks are disabled while the room is not in a
confirmed connected state to reduce stale submissions.

## Server-Authoritative Timer

PostgreSQL stores an absolute `pick_deadline_at` for an active draft. Pausing a
draft stores `paused_remaining_seconds`; resuming creates a new deadline from
that stored remainder. A completed pick advances the draft and creates the next
deadline in the same authoritative operation.

Clients request database server time and estimate their offset using the
network midpoint. Browser intervals only render the countdown. They do not
decide whether a pick is legal or advance the draft.

The current expiration policy is soft: reaching zero does not automatically
select a player or skip a team. The owner may still pick, and the commissioner
may use the recovery controls.

## Authentication and Authorization

Commissioners use persistent Supabase Auth accounts. A persistent account is
required to create drafts and use commissioner workflows.

Owners may join with a persistent account or through Supabase anonymous
authentication. Email invitations reserve a specific team for an email address;
the database claims that reservation when the authenticated user joins with the
matching verified identity. Generic join-code participants remain unassigned
until the commissioner assigns a team.

Row-level security limits draft reads to the commissioner and participating
users. PostgreSQL RPCs independently enforce commissioner, owner, team, status,
and on-the-clock permissions for mutations. Server routes using elevated
credentials must authenticate the request and explicitly verify authorization
before accessing or changing data.

## Known Technical Debt

- Local migration structure, the main authoritative RPC contracts, and current
  table-level RLS boundaries are automatically verified after a clean reset.
- Concurrent draft operations are checked for pick, lifecycle, assignment,
  invitation-claim, setup, and retry invariants against local PostgreSQL.
- Clean local schemas explicitly grant `service_role` the minimum table access
  required by the invitation workflow. Existing hosted privileges need a
  separate audit because grant migrations do not revoke prior access. New
  elevated routes must extend and test that privilege contract deliberately.
- Multiplayer and full-draft regression scripts depend on a configured Supabase
  environment and are not yet formal release gates.
- Browser E2E covers an isolated commissioner/owner Chromium journey through
  create, join, assignment, start, picks, pause/resume, offline reload recovery,
  undo, snake reversal, and completion. Mobile viewport and maintained device
  matrix coverage remain to be added.
- Operational telemetry, alerting, and commissioner recovery runbooks are not
  yet defined.
- Room reconciliation reloads broad snapshots, including the active player
  catalog, after many changes. This should be split and measured before scale.
- Anonymous ownership depends on the browser's Supabase session and needs a
  documented account-claim and lost-session recovery policy.
- Undo removes the pick rather than preserving a complete append-only audit
  history of commissioner actions.
- Teams and participants are currently draft-scoped. A persistent league,
  membership, and team model is required before league history is implemented.
- API and database types are maintained manually rather than generated from the
  deployed schema.
- Architecture, deployment, recovery, and supported-browser documentation must
  become release-controlled artifacts during Milestone 4A.

## Near-Term Direction

Milestone 4A keeps DraftHQ draft-first and focuses on release readiness. Before
Milestone 4B adds identity data, the schema should receive a separately planned
league-aware foundation that preserves standalone drafts and historical draft
snapshots. That schema work is not part of the current documentation-only
planning change.
