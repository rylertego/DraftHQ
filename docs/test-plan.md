# DraftHQ Test Plan

## Known Lint Issues

- `react-hooks/set-state-in-effect` currently fails in `src/app/draft/page.tsx` and `src/app/teams/page.tsx`.
- Cause: localStorage hydration uses synchronous state updates inside `useEffect`.
- Plan: resolve during Supabase migration by replacing localStorage hydration with backend-backed loading state.

---

## DB Contract Tests (`npm run test:db:contracts`)

### Reset Draft RLS

| Test | Expected |
|---|---|
| Commissioner DELETEs from `picks` for their own draft | Succeeds |
| Non-commissioner authenticated user DELETEs from `picks` | Denied (RLS) |
| Anonymous user DELETEs from `picks` | Denied (RLS) |
| Commissioner DELETEs picks for a draft they do not own | Denied (RLS) |

Status: Missing — DELETE RLS policy on `picks` for commissioner not yet written (M5 blocker).

### Add Member Commissioner Check

| Test | Expected |
|---|---|
| League owner calls `POST /api/leagues/[leagueId]/members` | 201 Created |
| League owner calls endpoint with email of existing user | 201 or 409 if already member |
| Non-member authenticated user calls endpoint | 403 Forbidden |
| Unauthenticated request | 401 Unauthorized |
| Email already a member | 409 Conflict |

Status: Needs reproduction — 403 reported in production for league owner.

### Draft Settings Persistence

Verify round-trip for every settings column:

| Column | API function | Test |
|---|---|---|
| `rounds` | `updateDraftRounds` | Set 10, reload, verify 10 |
| `team_count` | `updateDraftTeamCount` | Set 8, reload, verify 8; teams table updated |
| `pick_seconds`, `timer_behavior`, `clock_extension_seconds`, `max_clock_extensions` | `configureDraftTimer` | Set all, reload, verify all |
| `scheduled_at`, `scheduled_timezone` | `updateDraftSchedule` | Set date + tz, reload, verify |
| `roster_positions` | `updateDraftRosterPositions` | Disable K, reload, verify K disabled |
| `scoring_type` | `updateDraftExtras` | Set `ppr`, reload, verify |
| `use_whammies`, `whammy_count` | `updateDraftExtras` | Set true + 3, reload, verify |
| `hide_player_rankings` | `updateDraftExtras` | Set true, reload, verify |

Status: Mostly working; verify `roster_positions` JSONB round-trip with non-default positions.

### Pre-Draft Lobby

| Test | Expected |
|---|---|
| Participant joins draft; lobby shows updated member list in realtime | Realtime update received within 2s |
| Commissioner clicks "Start Draft" from lobby | Draft status changes to `active`; lobby redirects to draft room |
| Non-commissioner cannot trigger start | Button hidden or returns 403 |

Status: Lobby route not yet built (M6).

### Landmine Assignment

| Test | Expected |
|---|---|
| `assign_landmines(draft_id)` with `landmine_count = 5` | 5 player IDs stored in `drafts.landmine_player_ids` |
| All assigned players are in top 150 by rank | Pass (requires `player_rankings` table) |
| Players with keeper status excluded | Pass (requires keeper support) |
| Draft reset re-randomizes assignments | New set of IDs stored |
| `assign_landmines` called when `use_landmines = false` | Noop or error |

Status: Not started (M9).

### Roster Position Filtering

| Test | Expected |
|---|---|
| Kicker disabled in `roster_positions`; draft room player pool | No K players returned |
| DST disabled; draft room player pool | No DST (team defenses) returned; IDP players unaffected |
| All positions enabled | All active players returned |
| `roster_positions = null` | All active players returned (default behavior) |

Status: Column exists; filter logic not yet implemented in client (M7).

---

## RLS Contract Tests (`npm run test:db:rls`)

### Existing Coverage

- `picks`: INSERT restricted to team on clock or commissioner
- `drafts`: SELECT restricted to participants or commissioner
- `league_members`: SELECT restricted to league members

### Missing Coverage

| Table | Missing Test |
|---|---|
| `picks` | Commissioner DELETE (P0 blocker) |
| `picks` | Non-commissioner DELETE denied |
| `leagues` | Anon cannot SELECT |
| `league_seasons` | Non-member cannot SELECT |
| `draft_messages` | Non-participant cannot SELECT |

---

## Integration Tests (`npm run test:integration`)

| Flow | Status |
|---|---|
| Create league → create season → join draft → make picks → complete | Not covered |
| Reset draft (commissioner, with picks) | Not covered (RLS bug blocks it) |
| Add member (existing user) | Not covered |
| Add member (new user, invite email) | Not covered |
| Import Sleeper league → create season | Partial |

---

## E2E Tests (`npm run test:e2e`)

| Flow | Status |
|---|---|
| Commissioner creates league, creates season, starts draft | Not covered |
| Owner joins via join code, is assigned team, makes a pick | Partial |
| Full 2-team draft (commissioner + 1 owner, multiple rounds, complete) | Not covered |
| Timer expires → skip behavior fires | Not covered |
| Timer expires → auto_draft behavior fires | Not covered |
| Commissioner resets draft with existing picks | Not covered (RLS bug) |
| Pre-Draft Lobby: two users connect, commissioner starts draft | Not covered (lobby not built) |

---

## Unit Tests (`npm test` / vitest)

| Area | Status |
|---|---|
| `teamSetupLogic` (move team) | Covered |
| `participantLogic` (assigned team IDs) | Covered |
| Draft timer client-side countdown math | Not covered |
| Roster position filter logic | Not covered (function not yet written) |
| Landmine reveal detection logic | Not covered |
