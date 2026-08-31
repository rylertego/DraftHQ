# Watchable Draft Simulation

Date: 2026-08-31
Status: Approved, ready for planning

## Problem

`scripts/test-full-draft.mjs` already proves draft correctness: 12 teams, 15
rounds, 180 picks, asserting snake order, player uniqueness, and completion. Two
things stop it being a dress rehearsal:

1. It fires picks with no delay, so there is nothing to watch.
2. Its `finally` block deletes the draft, so nothing survives to inspect.

It also runs against throwaway leagues and teams, so it proves pick ordering but
tells you nothing about how draft night will actually look and sound.

What is missing is a simulation the commissioner can watch in the draft room,
using the real league's teams, to confirm picks land on the right teams in the
right order.

## Non-Goals

- Replacing `test-full-draft.mjs`. It stays as the fast headless correctness
  check; this is a separate, slower, human-facing script.
- Testing the timer, autodraft, chat, or landmines. Picks and their ordering are
  the subject.
- Any change to application code. This is a script plus an npm script entry.

## Environment

Runs against the production Supabase project, inside the real league
(Southcoast Gentlemen & Scholars). Confirmed present: 984 players, 10 active
league teams, all 10 with logos.

Known and accepted: only 1 of the 10 league teams currently has walk-up songs.
The other nine fall back to `getDefaultWalkUpSong(draftPosition)`. That is what
draft night looks like today, so the rehearsal reflects reality rather than
hiding it.

## Design

### Setup — service role

The script creates its own throwaway draft via `create_league_season_draft(
p_league_id, p_year, p_season_name, p_draft_name, p_team_count, p_rounds,
p_display_name)`, which seeds the 10 draft teams from the league teams: real
names, short names, logos, and owner names.

It must NOT reuse the league's existing "2026 Draft" (id
`bed6865c-2795-4ef9-823f-d4f031f841c5`, status `setup`) — that is the real one,
and 150 simulated picks would ruin it. The script creates a draft whose name is
clearly disposable and whose year does not collide with the real season.

It then creates 10 throwaway auth users with generated passwords and inserts them
directly into `draft_participants` with the service-role client, then assigns
each to a team with `assign_team(p_draft_id, p_participant_id, p_team_id)`.

**Direct insertion is deliberate.** The normal `join_draft` path also adds the
joiner as a league member (migration `20260629000004_join_draft_adds_league_member`).
Ten fake members in the real league roster is not an acceptable side effect of a
rehearsal.

### Picks — the real authenticated path

Each throwaway user signs in as itself and calls
`make_pick(p_draft_id, p_player_id, p_expected_pick)` with its own session — the
same path a real owner uses, with the same ordering checks and the same
`p_expected_pick` guard against double-picks.

Setup may cut corners with the service role; the behavior under test may not.

Each turn picks a random still-available player. Pace: one pick per ~5 seconds,
15 rounds, 10 teams, 150 picks — roughly 12–13 minutes.

### Watching

Before starting, the script prints the draft URL and join code, then waits for
Enter. That way the draft room is already open when the first pick lands.

Each pick logs one line, formatted so the console can be cross-checked against
the screen:

```
R3.07  overall 27  →  Trap Queens picks Ja'Marr Chase
```

### Assertions

After the final pick, reusing what `test-full-draft.mjs` already establishes:

- `status` is `complete`
- `current_pick` is 151
- 150 picks recorded, all player ids distinct
- the recorded team sequence equals the expected snake order

Failures print the offending pick numbers rather than only a boolean.

### Teardown

After the assertions the script pauses a second time, so the completed board can
be inspected — the thing most worth looking at should not vanish at the moment it
becomes interesting. On Enter it deletes the draft and the throwaway users.

Cleanup also runs from a `finally`, and a `--cleanup-only` flag re-runs it
standalone, because a mid-run Ctrl-C would otherwise strand a draft and ten users.
Throwaway users are identifiable by a fixed email prefix so cleanup can find them
without a prior run's bookkeeping.

The real league, its teams, its walk-up songs, and the real 2026 Draft are never
written to.

## Risks

- **It writes to production.** Mitigated by creating only a disposable draft and
  disposable users, never updating league rows, and by cleanup being re-runnable.
- **Ctrl-C mid-run** leaves a draft and ten users behind until `--cleanup-only`
  runs. Accepted, with the flag as the remedy.
- **Requires `SUPABASE_SECRET_KEY`** in `.env.local`, as the existing scripts do.
  It is never printed.
