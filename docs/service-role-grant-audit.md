# service_role Grant Audit

## Purpose

Supabase server routes use a service-role client (`supabaseAdmin`) to
authenticate callers and perform privileged operations. The service-role key
bypasses row-level security, so the database role's table-level grants are
the last privilege boundary at the PostgreSQL layer.

Migration `20260621000000_grant_server_route_privileges.sql` adds the minimum
required grants. However, it does **not** revoke privileges already present in
a hosted project. Supabase projects scaffolded with older defaults may carry
`ALL PRIVILEGES` on every table for `service_role`. This document records the
intended privilege state, the audit query, and the remediation SQL.

## Expected Privilege Matrix

The migration-defined state after a clean reset. `scripts/verify-local-migrations.mjs`
asserts this matrix after every `npm run test:db:migrations` run.

| Table                  | service_role privileges         | Rationale                                                                                       |
|------------------------|---------------------------------|-------------------------------------------------------------------------------------------------|
| `drafts`               | SELECT                          | Invitation route reads commissioner_user_id and join_code to authorize and build redirect URL.  |
| `teams`                | SELECT                          | Invitation route reads team membership to reject already-assigned teams.                         |
| `draft_participants`   | SELECT                          | Invitation route reads participant-team links to detect reserved seats.                          |
| `draft_invitations`    | SELECT, INSERT, UPDATE          | Invitation route upserts invitation records and reads status. No DELETE — cancel via UPDATE.    |
| `picks`                | (none)                          | All pick mutations go through security-definer RPCs. No server route reads picks directly.      |
| `players`              | (none)                          | Player import uses `replace_nflverse_players(jsonb)`, a security-definer RPC.                   |
| `profiles`             | (none)                          | Profile creation goes through the `handle_new_auth_user` security-definer trigger.              |

## RPC Grants

| Function                           | service_role privilege | Rationale                                                     |
|------------------------------------|------------------------|---------------------------------------------------------------|
| `replace_nflverse_players(jsonb)`  | EXECUTE                | Admin import script calls this RPC. Internal writes run as the function owner (postgres). |

## Routes That Use service_role

### `POST /api/drafts/[draftId]/invitations`

Reads the caller's JWT via `supabaseAdmin.auth.getUser()`, then:
1. Reads `drafts` (SELECT) — authorization check and join_code.
2. Reads `teams` (SELECT) — team existence and draft membership.
3. Reads `draft_participants` (SELECT) — seat availability.
4. Reads and upserts `draft_invitations` (SELECT, INSERT, UPDATE).
5. Calls `supabaseAdmin.auth.admin.inviteUserByEmail()` — Auth Admin API, no table grant needed.

### `GET /api/sleeper/leagues/[leagueId]/preview`

Reads the caller's JWT via `supabaseAdmin.auth.getUser()` only. Fetches from
the external Sleeper API. No table access in this route.

## Hosted-vs-Migration Gap

Supabase projects created before late 2023 — and some later projects — scaffold
with:

```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
-- or via ALTER DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
```

This gives `service_role` DELETE, TRUNCATE, REFERENCES, and TRIGGER in addition
to the read/write privileges the routes actually use, and it gives full access to
`picks`, `players`, and `profiles` which no server route touches directly.

The migration adds the grants it needs but does not issue REVOKE, so existing
excess privileges persist unchanged after deployment.

**Risk:** A bug or future route that uses `supabaseAdmin` directly against a
table could silently succeed where it should fail. Picks integrity is the
highest-sensitivity area: direct DELETE on `picks` bypasses all RPC validation
and audit trail.

## Audit Query (run against the hosted project)

```sql
-- Run in the Supabase SQL editor or via psql against the hosted project.
-- Compare to the Expected Privilege Matrix above.
SELECT
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee = 'service_role'
ORDER BY table_name, privilege_type;
```

**Expected output** (exactly these rows, nothing more):

| table_name           | privilege_type | is_grantable |
|----------------------|----------------|--------------|
| draft_invitations    | INSERT         | NO           |
| draft_invitations    | SELECT         | NO           |
| draft_invitations    | UPDATE         | NO           |
| draft_participants   | SELECT         | NO           |
| drafts               | SELECT         | NO           |
| teams                | SELECT         | NO           |

If the output includes additional rows (DELETE, TRUNCATE, or grants on picks /
players / profiles), apply the remediation below.

## Remediation SQL

Run this in the Supabase SQL editor **on the hosted project only** after
confirming the audit output shows excess grants. This is a one-time operation;
the migration already handles clean schemas.

```sql
-- Revoke ALL first, then restore exactly what is needed.
-- This is safe to run while the application is live; service-role connections
-- are server-side only and the Next.js routes will continue to work because
-- the required SELECT/INSERT/UPDATE grants are re-added immediately after.

BEGIN;

REVOKE ALL ON public.drafts            FROM service_role;
REVOKE ALL ON public.teams             FROM service_role;
REVOKE ALL ON public.draft_participants FROM service_role;
REVOKE ALL ON public.draft_invitations  FROM service_role;
REVOKE ALL ON public.picks             FROM service_role;
REVOKE ALL ON public.players           FROM service_role;
REVOKE ALL ON public.profiles          FROM service_role;

GRANT SELECT
  ON public.drafts, public.teams, public.draft_participants
  TO service_role;

GRANT SELECT, INSERT, UPDATE
  ON public.draft_invitations
  TO service_role;

COMMIT;
```

After running, re-execute the audit query to confirm exactly the expected rows
are present. Then exercise the invitation workflow end-to-end to confirm the
route still functions.

## New Route Checklist

When adding a new server-side route that uses `supabaseAdmin`:

1. List every table the route reads or writes.
2. Add a migration that grants only the required privileges.
3. Update `expectedServiceRoleGrants` in `scripts/verify-local-migrations.mjs`.
4. Update this document's Expected Privilege Matrix and the hosted Remediation SQL.
5. Re-run `npm run test:db:migrations` to confirm the verifier passes.

## Audit Status

| Date       | Operator | Local schema verified | Hosted audit performed | Hosted remediation applied |
|------------|-----------|-----------------------|------------------------|----------------------------|
| 2026-06-22 | Agent     | Pending (local Supabase not running in CI environment — run `npm run test:db:migrations` locally) | Pending (requires hosted project credentials) | Pending |

The local migration verifier (`scripts/verify-local-migrations.mjs`) now
asserts the exact grant matrix after every clean reset. Hosted verification and
any required remediation must be performed manually by the project operator
before the Milestone 4A release gate is satisfied.
