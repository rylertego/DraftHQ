# DraftHQ Release Checklist

This checklist defines the release foundation for Milestone 4A. A checked item
must have repeatable evidence; a manual claim without logs or recorded results
does not satisfy a release gate.

## Local Prerequisites

- Install the repository dependencies with `npm install`.
- Install and start Docker Desktop.
- Start the local stack with `npm run supabase:start`.
- Confirm local Supabase reports healthy before running database checks.
- Keep production secrets out of local test configuration and committed files.

## Current Automated Checks

Run these checks for every release candidate:

```powershell
npm test -- --run
npm run lint
npm run build
npm run test:db:migrations
npm run test:db:contracts
```

`test:db:migrations` resets the local database, applies every migration in
order, loads `supabase/seed.sql`, and verifies required tables, RPC signatures,
Realtime publication membership, seed players, constraints, and indexes. The
verifier refuses non-loopback database hosts. The reset is destructive to the
local Supabase database and must never be pointed at a shared or production
project.

The database contract command performs a clean migration reset and then runs
the authoritative RPC, RLS, and concurrency contract suites against isolated
local users and drafts.

## Reserved Release Checks

The following commands are intentionally non-passing placeholders. They exit
with code 2 so an unimplemented suite cannot be mistaken for a successful
release gate.

```powershell
npm run test:integration
npm run test:e2e
npm run verify:release
```

Later Milestone 4A phases will replace these placeholders with pgTAP, Supabase
integration, Playwright, and aggregate release verification commands.

## Database Readiness

- Clean migration reset passes.
- Deterministic seed loads successfully.
- Database contract, RLS, and concurrency suites pass when implemented.
- Migration changes have a documented rollback or forward-fix procedure.
- The expected-pick RPC migration and matching application build are deployed
  together because older two-argument pick calls are intentionally rejected.
- Production backup availability and restoration have been verified.

## Application Readiness

- Unit tests, lint, TypeScript compilation, and production build pass.
- Critical browser journeys pass when the E2E suite is implemented.
- No service-role or secret key is present in browser configuration or output.
- Hosted `service_role` table grants have been audited for privileges inherited
  from earlier project defaults.
- Environment variables and authentication redirect URLs match the deployment.
- Player data is current and its import result has been reviewed.

## Mobile Readiness

- The supported-browser matrix has been executed.
- iOS Safari, Android Chrome, and tablet results are recorded.
- Draft board, pick modal, timer, team assignment, and commissioner controls are
  usable in portrait and landscape where applicable.
- Safe-area, virtual-keyboard, text-scaling, and reconnect behavior pass.

## Draft-Night Readiness

- Commissioner and backup commissioner contacts are confirmed.
- All teams have verified owners before draft start.
- Timer, rounds, team order, and join links are confirmed.
- Commissioner recovery and owner replacement procedures have been rehearsed.
- Observability dashboards and alerts are available when implemented.
- A controlled full-draft rehearsal has passed without direct database edits.

## Release Record

For each candidate, record:

- Commit SHA and deployment URL
- Database migration version
- Date and operator
- Automated check results
- Browser and device results
- Known issues and accepted risks
- Backup and rollback confirmation
- Final release decision
