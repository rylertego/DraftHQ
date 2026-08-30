# League-First Draft Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make leagues the source of membership, team ownership, and draft access, with draft codes retained only as a temporary compatibility path.

**Architecture:** League members and league teams become authoritative for who belongs to an experience and which team they own. Draft setup reads those relationships and snapshots/links them into a draft, while draft-room/lobby code stops creating a parallel owner-invite system.

**Tech Stack:** Next.js App Router, React, Supabase/Postgres, existing league/draft API modules, Vitest.

**Spec:** User direction from 2026-08-21: users should set up a league and invite people to that league; DraftHQ should move away from standalone host-a-draft/join-by-code as the primary flow.

## Global Constraints

- Reliable multiplayer draft room remains the first product priority.
- Commissioner can edit all teams/settings.
- Assigned owner can edit only their own team profile.
- Keep draft correctness in Supabase/Postgres when possible.
- Do not expose service role keys.
- Do not use localStorage as authoritative draft state.
- Use `npx supabase db push` for migrations; do not apply SQL in the Supabase dashboard.
- Do not re-run applied schema-history migrations with `--include-all`.
- Preserve tests and run `npm test` plus `npm run build` before completion.
- `npm run lint` has many pre-existing issues; lint touched files directly.

---

## File Structure

- Modify `src/app/teams/TeamSetupForm.tsx`: keep draft settings focused on draft-only controls; remove draft-specific owner invite management.
- Modify `src/app/leagues/[slug]/teams/LeagueTeams.tsx`: make league team ownership/invites the main commissioner workflow.
- Modify `src/app/leagues/[slug]/members/LeagueMembers.tsx`: make member invite status and team assignment clearer.
- Modify `src/lib/leagueApi.ts`: expose the league-member/team ownership operations needed by draft setup and lobby.
- Modify `src/lib/draftApi.ts`: deprecate draft invitation creation in UI-facing paths; keep APIs until imports and legacy join paths are retired.
- Modify `src/app/draft/DraftRoom.tsx` and `src/components/DraftLobby.tsx`: use league membership/team ownership as the primary lobby seating model.
- Modify `src/app/join/[joinCode]/*` or existing join-code route files: add compatibility messaging and redirect league-backed drafts toward league invitation/login flows.
- Create or modify Supabase migrations only if current schema cannot express league-member-to-draft-team ownership without duplicated draft invitations.
- Add or update tests in `tests/unit/*` for ownership derivation and route/component behavior.

---

### Task 1: Remove Draft Settings Owner Invite Controls

**Files:**
- Modify: `src/app/teams/TeamSetupForm.tsx`

**Interfaces:**
- Consumes: existing `setup.participants`, `setup.invitations`, and `saveTeam(teamId)`.
- Produces: Draft Settings team rows that display owner state but do not assign members or invite owners by email.

- [x] **Step 1: Remove row-level draft invite UI**

Remove the unassigned-owner controls that render:

```tsx
<Select aria-label="Assign existing member" />
<Input placeholder="Invite by email" />
<Button>Save team & invite owner</Button>
```

- [x] **Step 2: Remove component-local invitation helpers**

Delete state and functions only used by that UI:

```ts
inviteEmail
inviteTeamId
isInviting
sendEmailInvitation
copyOwnerInvite
copyOwnerInviteDetails
```

- [x] **Step 3: Keep non-invite owner state visible**

Unassigned teams show static copy:

```tsx
<p>No owner assigned</p>
```

Pending legacy invitations can still show as `Invited`, but Draft Settings must not expose copy/send controls.

- [x] **Step 4: Verify**

Run:

```bash
npx eslint src/app/teams/TeamSetupForm.tsx
npm run typecheck
```

Expected: both pass.

---

### Task 2: Make League Teams The Owner Assignment Surface

**Files:**
- Modify: `src/app/leagues/[slug]/teams/LeagueTeams.tsx`
- Modify: `src/lib/leagueApi.ts`
- Test: `tests/unit/leagueTeamOwnership.test.ts`

**Interfaces:**
- Consumes: league members and league teams from `leagueApi`.
- Produces: one commissioner workflow for assigning an existing league member or inviting a new member to own a league team.

- [ ] **Step 1: Write ownership behavior tests**

Add tests that assert this domain behavior:

```ts
expect(assignLeagueTeamOwner({ teamId, memberId })).toEqual({
  leagueTeamId: teamId,
  ownerUserId: memberId,
});
expect(inviteLeagueMember(email, { leagueTeamId: teamId })).resolves.toMatchObject({
  email,
  leagueTeamId: teamId,
});
```

- [ ] **Step 2: Keep invitation copy league-scoped**

The invite CTA should say `Invite league member`, and the saved invitation should be tied to `leagueTeamId`, not `draftTeamId`.

- [ ] **Step 3: Show assignment source clearly**

League Teams should display current owner, pending invite, and unassigned state. Do not add readiness percentages, status pills, or eyebrow-above-heading patterns.

- [ ] **Step 4: Verify**

Run:

```bash
npx eslint src/app/leagues/[slug]/teams/LeagueTeams.tsx src/lib/leagueApi.ts
npm test
```

Expected: touched-file lint passes; tests pass.

---

### Task 3: Derive Draft Team Ownership From League Teams

**Files:**
- Modify: `src/lib/draftApi.ts`
- Modify: `src/app/teams/TeamSetupForm.tsx`
- Test: `tests/unit/draftLeagueOwnership.test.ts`

**Interfaces:**
- Consumes: `draft.leagueId`, `league_teams.owner_user_id`, `draft_teams`.
- Produces: draft setup data where `draft_teams.owner_user_id` follows league team ownership for league-backed drafts.

- [ ] **Step 1: Add a pure mapper test**

```ts
expect(resolveDraftOwnerFromLeagueTeam({
  draftTeamLeagueTeamId: "league-team-1",
  leagueTeams: [{ id: "league-team-1", ownerUserId: "user-1" }],
})).toBe("user-1");
```

- [ ] **Step 2: Implement mapper in draft API/domain layer**

Create a named helper:

```ts
export function resolveDraftOwnerFromLeagueTeam(input: {
  draftTeamLeagueTeamId: string | null;
  leagueTeams: Array<{ id: string; ownerUserId: string | null }>;
}) {
  return input.leagueTeams.find((team) => team.id === input.draftTeamLeagueTeamId)?.ownerUserId ?? null;
}
```

- [ ] **Step 3: Apply mapper when loading draft setup**

For league-backed drafts, load league team ownership and merge it into draft setup response data before React renders.

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- draftLeagueOwnership
npm run typecheck
```

Expected: mapper tests and typecheck pass.

---

### Task 4: Convert Draft Lobby Seating To League Membership

**Files:**
- Modify: `src/components/DraftLobby.tsx`
- Modify: `src/components/CommissionerParticipantManager.tsx`
- Modify: `src/app/draft/DraftRoom.tsx`
- Test: `tests/unit/draftLobby.test.tsx`

**Interfaces:**
- Consumes: league-backed draft setup with owner assignments.
- Produces: lobby seating that uses league members as the source and keeps `CommissionerParticipantManager` for seating guests who joined by code during the transition.

- [ ] **Step 1: Write lobby render tests**

Assert that league-backed drafts show `Seat owners` only for commissioner transition handling and do not present draft-owner invite inputs.

- [ ] **Step 2: Keep code guests as transitional participants**

`CommissionerParticipantManager` remains in the lobby so commissioners can seat guests who joined by code. Do not delete it.

- [ ] **Step 3: Refresh from league ownership changes**

When owner assignments change, call the existing lobby refresh path so the displayed draft team owner updates without a full reload.

- [ ] **Step 4: Verify**

Run:

```bash
npx eslint src/components/DraftLobby.tsx src/components/CommissionerParticipantManager.tsx src/app/draft/DraftRoom.tsx
npm test -- draftLobby
```

Expected: touched-file lint passes; lobby tests pass.

---

### Task 5: De-emphasize Standalone Draft Join Codes

**Files:**
- Modify: `src/app/create/*` or current create draft route files
- Modify: `src/app/join/[joinCode]/*`
- Modify: `src/app/join/*`
- Test: `tests/unit/joinFlow.test.ts`

**Interfaces:**
- Consumes: existing join-code routes and draft creation flow.
- Produces: league-first CTAs while preserving join codes as compatibility for drafts that already use them.

- [ ] **Step 1: Identify standalone draft entry points**

Search:

```bash
rg -n "Join Draft|joinCode|join code|create draft|host draft" src/app src/components
```

- [ ] **Step 2: Change primary CTAs**

Primary path should be:

```text
Create league -> Invite league members -> Create draft
```

Standalone draft creation and join-code entry remain secondary until fully retired.

- [ ] **Step 3: Add league-backed join redirect**

If a join code belongs to a league-backed draft and the user is not a league member, route them to the league invitation/login path instead of creating a draft-only owner.

- [ ] **Step 4: Verify**

Run:

```bash
npm test -- joinFlow
npm run build
```

Expected: compatibility join still works, league-backed join uses league membership.

---

### Task 6: Retire Draft Invitations After Compatibility Window

**Files:**
- Modify: `src/lib/draftApi.ts`
- Modify: `src/app/api/drafts/[draftId]/invitations/route.ts`
- Modify: Supabase migration if retiring tables/columns
- Modify: docs/status/plan notes

**Interfaces:**
- Consumes: existing draft invitation API and legacy data.
- Produces: either a documented compatibility API or a removed route after all callers migrate.

- [ ] **Step 1: Find all draft invitation callers**

Run:

```bash
rg -n "inviteOwner|draft_invitations|/api/drafts/.*/invitations|DraftInvitation" src tests supabase
```

- [ ] **Step 2: Move remaining callers to league invitations**

Provider imports and Sleeper imports should invite league members to league teams, then drafts inherit ownership.

- [ ] **Step 3: Mark API compatibility status**

If keeping the route, add a server-side comment and a test proving it rejects league-backed draft invite creation.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
npm run build
```

Expected: no UI path creates draft-specific owner invitations for league-backed drafts.

---

## Self-Review

- Spec coverage: the plan moves ownership, invitations, lobby seating, and join-code entry points toward league-first flows.
- Placeholder scan: no task uses TBD/TODO/fill-in placeholders.
- Type consistency: `leagueTeamId`, `draftTeamId`, `ownerUserId`, and `resolveDraftOwnerFromLeagueTeam` are named consistently across tasks.
