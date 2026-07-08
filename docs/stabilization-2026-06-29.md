# Stabilization Pass — 2026-06-29

Based on the Codex audit (`docs/audit-2026-06-29.md`). Scope: security, permissions, release-gate cleanup, and reliability only. No product polish.

---

## What Was Fixed

### Security

**C1 — `reset_draft` commissioner authority bypass**
- `reset_draft` had a dual-check: it first verified `drafts.commissioner_user_id`, but if that failed it fell back to `draft_participants.role = 'commissioner'`. After an ownership transfer, the old commissioner's participant row was not updated, so they could still reset the draft.
- Migration `20260629000011` rewrites `reset_draft` to check only `commissioner_user_id` and includes a data-repair `UPDATE` that demotes stale participant `role = 'commissioner'` rows to `'owner'`.

**C2 — Draft storage bucket policies**
- `draft-team-logos`, `draft-owner-photos`, and `draft-audio` buckets had open policies allowing any authenticated user to write to any path.
- Migration `20260629000012` adds `can_manage_draft_team_asset(draft_id, team_id)` helper function and replaces the open policies:
  - **Team logos / owner photos**: commissioner or the assigned team owner for that specific team.
  - **Audio**: commissioner only.
- `league-assets` bucket (league logo/banner) is deferred — see Deferred section.

**C3 — `upsert_bye_weeks` open to all authenticated users**
- Migration `20260629000010` revokes execute from `authenticated` and `public`, grants to `service_role` only.
- Dead client-side export `upsertByeWeeks` in `src/lib/draftApi.ts` was removed (it called the RPC via the user JWT, which now fails by design).

**C4 — Rankings sync unauthenticated**
- `POST /api/rankings/sync` had no authentication at all.
- `GET /api/rankings` triggered sync inline for any public caller with no year validation.
- Fixed:
  - Sync POST is now fail-closed in production: returns 503 if `RANKINGS_SYNC_SECRET` is not set; returns 401 if the secret is wrong. Local dev (`NODE_ENV !== 'production'`) remains open.
  - GET route skips the inline sync trigger entirely in production when `RANKINGS_SYNC_SECRET` is not set (no point firing a request that will 503).
  - Year parameter bounded to 2020–currentYear+1 in both routes.

**I9 — MFL API key in URL query string**
- `GET /api/providers/mfl/preview?apiKey=...` exposed the user's MFL API key in server logs and browser history.
- Route changed to `POST` with key in the JSON body. Client (`src/lib/providerApi.ts`) updated to match.

### Reliability

**I2 — Realtime CHANNEL_ERROR leaves room stuck**
- When Supabase realtime fires `CHANNEL_ERROR` while the tab is active and online, neither the `online` nor `focus` events fire. The room stayed on error status until the user did something.
- Added a 3-second deferred `recover()` call in the channel status callback. Recovery unsubscribes the dead channel and creates a new one. No duplicate subscriptions; no memory leak (guarded by `!cancelled`).

### Bug Fixes

**P1 — Nested `<a>` in dashboard**
- `LeagueRow` was a `<Link>` containing a "Team Owner" `<Link>`, producing invalid `<a>` inside `<a>` HTML.
- Outer `<Link>` replaced with `<div role="link">` + `useRouter().push()`.

**P4 — `PickCard` defined inside render**
- `PickCard` and its companion `POSITION_COLORS` map were defined inside `RoundRecapModal`, causing a new component identity on every render.
- Moved to module scope; `team` now passed as a prop instead of captured from closure.

### Release-Gate Tooling

**Q1** — Added `.claude/**` to `vitest.config.ts` exclude list so agent worktrees don't pollute test discovery.

**Q2** — Added missing `isLandmine: false` to `Pick` fixture in `tests/unit/draftExport.test.ts`.

**Q3** — Added `.claude/**` to `eslint.config.mjs` globalIgnores. Fixed unescaped-entity lint errors in `TeamSetupForm.tsx` and `DraftRoom.tsx`.

**Scripts added to `package.json`:**

| Script | Purpose |
|---|---|
| `typecheck` | `tsc --noEmit` |
| `test:unit` | `vitest --run` (single-pass, no watch) |
| `lint:errors` | `eslint --quiet` (errors only, suppresses warnings) |
| `verify:release:local` | `typecheck && test:unit && build` — passes without Docker |
| `verify:release` | Full gate including DB/e2e (requires local Supabase) |

---

## What Remains Deferred

| Item | Why deferred |
|---|---|
| 8 `react-hooks/set-state-in-effect` lint errors | Each site needs a characterization test before refactoring to avoid cascading-render bugs. Files: `DraftRoom.tsx`, `LeagueTeams.tsx`, `TeamSetupForm.tsx`, `SongPicker.tsx`, `useLeagueWorkspace.ts`, `JoinDraftForm.tsx`. |
| `league-assets` storage policies (C2 partial) | Path format is `{folder}/{leagueId}-{timestamp}.ext`. The timestamp makes commissioner-scoped policies impossible without a path migration to `{leagueId}/{type}.ext`. TODO comment added in `LeagueSettingsForm.tsx` and `20260629000012`. |
| C5 — Yahoo OAuth cross-account token | Architecture change required (per-user token isolation). |
| I1 — Co-commissioner UI / permission mismatch | Product capability decision needed before implementing. |
| I3–I7 — Realtime revision/snapshot/chat issues | Require redesign or targeted tests; out of scope for stabilization. |
| I8 — Rate limiting on public endpoints | Needs infrastructure decision (Vercel Edge middleware, Upstash, etc.). |
| I10 — Invitation atomicity (email + DB) | Needs a server-side transaction or saga pattern. |
| I11 — Spotify tokens in localStorage | Security improvement but not an MVP blocker. |
| `draft_participants.role` stale rows in live data | Migration 011 data-repair runs on deploy — verify post-migration. |

---

## Required Deployment Steps

### 1. Set Vercel Environment Variables

| Variable | Value | Required by |
|---|---|---|
| `RANKINGS_SYNC_SECRET` | Random secret, e.g. `openssl rand -hex 32` | `POST /api/rankings/sync` |

Without `RANKINGS_SYNC_SECRET`, the sync endpoint returns 503 and rankings are served from whatever data exists in the DB (stale or empty). Set this before the first deploy.

### 2. Run Supabase Migrations (in order)

Run each in the Supabase SQL editor on the hosted project. They are idempotent where possible.

| Migration | What it does |
|---|---|
| `20260629000009_allow_commissioner_pick_without_participant.sql` | Commissioner can make a recovery pick even if they have no `draft_participants` row |
| `20260629000010_lock_upsert_bye_weeks_to_service_role.sql` | Revokes `upsert_bye_weeks` from authenticated users |
| `20260629000011_fix_reset_draft_commissioner_check.sql` | Removes participant-role fallback from `reset_draft`; repairs stale `draft_participants` rows |
| `20260629000012_harden_draft_storage_policies.sql` | Locks down draft-team-logos, draft-owner-photos, draft-audio storage policies |

---

## Manual Verification Checklist After Deployment

### Commissioner Authority (migration 011)
- [ ] Commissioner can reset a draft from scratch (picks deleted, teams reset)
- [ ] Former commissioner (after `transfer_league_ownership`) cannot reset the draft — should get "Only the draft commissioner can reset the draft."
- [ ] Current commissioner can still start, pause, resume, undo picks (these RPCs were not touched)

### Storage Policies (migration 012)
- [ ] Commissioner can upload a team logo in the draft room
- [ ] Commissioner can upload owner photos
- [ ] Commissioner can upload SFX audio files
- [ ] An assigned team owner (non-commissioner) can upload their own team's logo
- [ ] An assigned team owner **cannot** upload to a different team's logo path
- [ ] A user with no participant role cannot upload to any draft bucket
- [ ] Public users can still read (view) all draft team logos, photos, and audio

### Rankings Sync (C4 fix)
- [ ] `POST /api/rankings/sync` without `x-rankings-sync-secret` header returns 401
- [ ] `POST /api/rankings/sync` with correct secret and a valid year returns `{ synced: N, year }`
- [ ] `POST /api/rankings/sync` with year outside 2020–2027 returns 400
- [ ] `GET /api/rankings?type=standard` returns rankings (may be stale if no sync has run yet)

### MFL Import (I9 fix)
- [ ] New season import with MFL provider and an API key successfully previews the league

### Realtime Recovery (I2 fix)
- [ ] Open a draft room, disconnect network briefly, reconnect — room recovers without page reload
- [ ] Check browser console: no uncaught errors related to duplicate channel subscriptions

### Commissioner Recovery Pick (migration 009)
- [ ] Commissioner can make a pick for a team even if they have no `draft_participants` row for that team (relevant for league-linked drafts where the commissioner never formally joined as a participant)

---

## Remaining MVP Risks

| Risk | Severity | Notes |
|---|---|---|
| `league-assets` bucket has no RLS | Medium | Any authenticated user can overwrite another league's logo/banner. Mitigated by the fact that the bucket name is not guessable from the UI, but it's an open write path. |
| `RANKINGS_SYNC_SECRET` not set on deploy | Medium | Rankings will never auto-refresh in production until the var is configured. Existing data is served stale. |
| 8 deferred lint errors | Low | Not runtime bugs. Will block `lint:errors` from exiting 0 until fixed. |
| Co-commissioner permissions undefined | Low | Co-commissioners see commissioner UI in some places but RPCs reject them. No data corruption risk; just confusing UX. |
| Realtime recovery is not exponential backoff | Low | Fixed 3 s retry. If Supabase is down for an extended period, clients retry every 3 s. Acceptable for current scale. |
| `draft_participants` stale rows pre-dating migration 011 | Low | The data-repair UPDATE in migration 011 handles these on deploy. Verify post-migration that no `role = 'commissioner'` rows exist where the user is not `drafts.commissioner_user_id`. |
