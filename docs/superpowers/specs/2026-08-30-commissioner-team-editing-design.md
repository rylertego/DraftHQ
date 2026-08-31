# Commissioner Team Editing: One Editor, Any Team

Date: 2026-08-30
Status: Approved, ready for planning

## Problem

Commissioners can already edit other teams, but only through a reduced editor.
The Edit Team modal in `src/app/leagues/[slug]/teams/LeagueTeams.tsx` covers name,
short name, owner name, logo, owner assignment, and owner invites. The full team
profile at `/leagues/[slug]/my-team` additionally covers TTS name, owner photo,
and walk-up songs.

So the fields a commissioner most needs before draft night — the ones that drive
the presentation — are exactly the ones they cannot reach for anyone else's team.
AGENTS.md states "Commissioner can edit all teams/settings"; today that is only
partly true.

Two editors over the same rows is also the duplication trap already corrected
once this cycle, when the Spotify connection had a panel on My Team and a control
in the song picker.

## Non-Goals

- Autodraft, pre-draft notes, and last-season details. Those describe one draft
  night rather than the franchise, and deliberately live on the draft.
- Any change to what a plain member can do or see.
- Any database migration. Verified against the live project: `tts_name`,
  `walk_up_songs`, and `owner_photo_url` already carry UPDATE grants for
  `authenticated`, and the commissioner RLS path is proven by the existing modal.

## Design

### 1. One route, one editor

`/leagues/[slug]/my-team` remains the only team editor, and `MyTeamForm` remains
the only implementation. Nothing new is created that could drift from it.

`WorkspaceLayoutClient` labels the sidebar entry "Teams" when
`workspace.canManage` is true, and "My Team" otherwise. `canManage`
(`leagueApi.ts:326`) is already true for the league owner, commissioners, and
co-commissioners, so no new role plumbing is needed.

The route accepts an optional `?teamId=` so the roster can deep-link to one team.

### 2. Team switcher

When `canManage`, a select above the form lists every league team ordered by
draft position.

Initial selection:

1. `?teamId=` when present and valid for this league
2. otherwise `workspace.myTeam.id`
3. otherwise the first team — a commissioner does not necessarily own one

Members render no selector and see no behavioral change.

Switching teams while the form holds unsaved manual edits (name, short name,
owner name, TTS name, or a pending logo/photo file) prompts for confirmation
first. Walk-up songs are exempt: they already persist on add and remove.

### 3. Saving splits by target

- Own team: `updateMyLeagueTeamDetails` — unchanged. Full-field RPC semantics
  where null means "clear", so every field must be sent.
- Another team: `updateLeagueTeamDetails` — a partial patch on `league_teams`.
  It already handles name, short name, owner name, logo, owner photo, and
  walk-up songs. It is missing `ttsName`, which this design adds.

The patch shape is a good fit for the commissioner path: fields the form does not
edit (last-season values) are simply omitted and left untouched, rather than
needing to be echoed back.

The song auto-save (`persistSongs`) follows the same split.

### 4. Owner section absorbs the modal's remaining job

Replacing the modal means the new page must take on everything it did, not only
the overlapping fields. A manager-only Owner section on the Teams page carries
across, from `LeagueTeams.tsx`:

- assign an owner from the league's members
- invite an owner by email

Without this, replacing the modal would silently delete two capabilities.

### 5. Roster page

The roster's "Edit team" action (`LeagueTeams.tsx:658` and `:723`) navigates to
`/leagues/[slug]/my-team?teamId=<id>` instead of opening the modal, and
`EditTeamModal` is deleted along with its now-unused state.

The roster keeps every other job it has: listing, archiving, team counts.

## Testing

This repo has no jsdom and no @testing-library/react; component assertions use
`renderToStaticMarkup` and cannot fire events. Logic that would otherwise need
interaction is therefore extracted as pure functions and unit-tested:

- `resolveInitialTeamId(teamIdParam, myTeamId, teams)` — the three-step fallback
  above, including an invalid or foreign `teamId` param.
- `isTeamProfileDirty(form, team)` — whether switching should confirm; must
  ignore walk-up songs.
- The sidebar label choice as a function of `canManage`.

Existing tests in `tests/unit/songPicker.test.ts` that render `MyTeamForm`
exports must keep passing.

`npm test` and `npm run build` must pass, per AGENTS.md.

## Blast Radius

GitNexus `impact` remains unavailable (the MCP server runs an older build than
the on-disk index), so callers were traced by search. Verify with `impact` once
the server is restarted.

- `MyTeamForm` is imported only by `src/app/leagues/[slug]/my-team/page.tsx`, and
  its exports (`SongPlaybackBadge`) by `tests/unit/songPicker.test.ts`.
- `updateLeagueTeamDetails` is called only by `LeagueTeams.tsx` today; this adds
  `MyTeamForm` as a caller.
- `WorkspaceLayoutClient` renders the sidebar for every league page; the change
  there is one label, but the file is on every league route.
