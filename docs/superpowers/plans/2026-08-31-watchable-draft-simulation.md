# Watchable Draft Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A script that runs a full 15-round draft inside the real league at a watchable pace, so the commissioner can see every pick land on the right team, then verify snake order and completion before deleting everything it created.

**Architecture:** Pure decision logic lives in `scripts/lib/simDraft.mjs` and is unit-tested with vitest. The orchestration script `scripts/sim-draft.mjs` does the I/O: service-role setup, authenticated picks through `make_pick`, assertions, and teardown. Setup may use the service role; the pick path may not, because pick ordering is the thing under test.

**Tech Stack:** Node ESM (`.mjs`), `@supabase/supabase-js`, `node:assert/strict`, `node:readline`, Vitest 4.

## Global Constraints

- Runs against PRODUCTION Supabase. It may create only a disposable draft, a
  disposable league season, disposable auth users, and one disposable
  `league_members` row. It must never UPDATE or DELETE any pre-existing league,
  league team, walk-up song, or draft.
- It must never touch the real draft `bed6865c-2795-4ef9-823f-d4f031f841c5`
  ("2026 Draft", status `setup`). Assert the id it operates on differs from this.
- Existing scripts are the house pattern: read `scripts/test-full-draft.mjs`
  before writing anything. Reuse its `rpc()`, `selectRows()`, and
  `createUserAndSignIn()` shapes rather than inventing new ones.
- Secrets come from `.env.local` via `node --env-file=.env.local`, as the other
  scripts do. Never print a key or a generated password.
- Vitest tests live in `tests/unit/` and may not click, type, or fire events.
  There is no jsdom. These tests are pure-function tests, so that does not arise.
- 10 teams, 15 rounds, 150 picks, ~5 seconds per pick.
- Commit after every task.

## Deviation From The Spec

The spec says setup runs "via service role". That is not fully possible:
`create_league_draft` guards on `is_league_commissioner(p_league_id)`, which
resolves identity through `auth.uid()` (`20260622000000_add_league_identity_layer.sql:75-91`).
Under a service-role client `auth.uid()` is null, so the guard rejects it.

Therefore one throwaway user is inserted into `league_members` with role
`co-commissioner`, creates the draft as an authenticated user, and that row is
deleted during teardown. This is one transient row rather than the ten permanent
ones `join_draft` would have added, and it keeps draft creation on the same code
path the app uses. Recorded here rather than silently done.

---

### Task 1: Pure simulation helpers

**Files:**
- Create: `scripts/lib/simDraft.mjs`
- Test: `tests/unit/simDraft.test.ts` (new)

**Interfaces:**
- Produces:
  - `snakeTeamIndex(overallPickNumber: number, teamCount: number): number`
  - `formatPickLine({ overallPickNumber, teamCount, teamName, playerName }): string`
  - `SIM_EMAIL_PREFIX: string` — `"sim-draft-"`
  - `isSimEmail(email: string | null | undefined): boolean`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/simDraft.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  snakeTeamIndex,
  formatPickLine,
  isSimEmail,
  SIM_EMAIL_PREFIX,
} from "../../scripts/lib/simDraft.mjs";

describe("snakeTeamIndex", () => {
  it("runs the first round forwards", () => {
    expect(snakeTeamIndex(1, 10)).toBe(0);
    expect(snakeTeamIndex(10, 10)).toBe(9);
  });

  it("reverses the second round", () => {
    expect(snakeTeamIndex(11, 10)).toBe(9);
    expect(snakeTeamIndex(20, 10)).toBe(0);
  });

  it("turns back again for the third round", () => {
    expect(snakeTeamIndex(21, 10)).toBe(0);
    expect(snakeTeamIndex(30, 10)).toBe(9);
  });

  it("gives the same team back-to-back picks across a turn", () => {
    // pick 10 ends round 1, pick 11 opens round 2 — both team index 9
    expect(snakeTeamIndex(10, 10)).toBe(snakeTeamIndex(11, 10));
  });

  it("covers every team exactly once per round", () => {
    const round = Array.from({ length: 10 }, (_, i) => snakeTeamIndex(i + 1, 10));
    expect([...round].sort((a, b) => a - b)).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });
});

describe("formatPickLine", () => {
  it("labels round and pick-in-round, not just the overall number", () => {
    expect(
      formatPickLine({ overallPickNumber: 27, teamCount: 10, teamName: "Trap Queens", playerName: "Ja'Marr Chase" })
    ).toBe("R3.07  overall 27  →  Trap Queens picks Ja'Marr Chase");
  });

  it("pads the pick-in-round so lines stay aligned", () => {
    expect(
      formatPickLine({ overallPickNumber: 1, teamCount: 10, teamName: "A", playerName: "B" })
    ).toBe("R1.01  overall 1  →  A picks B");
  });
});

describe("isSimEmail", () => {
  it("recognises addresses this script generates", () => {
    expect(isSimEmail(`${SIM_EMAIL_PREFIX}abc@example.com`)).toBe(true);
  });

  it("leaves real accounts alone", () => {
    expect(isSimEmail("rylertego@gmail.com")).toBe(false);
    expect(isSimEmail("full-draft-123@example.com")).toBe(false);
    expect(isSimEmail(null)).toBe(false);
    expect(isSimEmail(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/simDraft.test.ts`
Expected: FAIL — `scripts/lib/simDraft.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `scripts/lib/simDraft.mjs`:

```js
/** Pure helpers for the watchable draft simulation. Kept free of Supabase and
 *  node I/O so they can be unit-tested; the orchestration lives in
 *  scripts/sim-draft.mjs. */

export const SIM_EMAIL_PREFIX = "sim-draft-";

/** Snake order: odd rounds run forwards, even rounds backwards. Matches
 *  getTeamIndex in scripts/test-full-draft.mjs. */
export function snakeTeamIndex(overallPickNumber, teamCount) {
  const round = Math.floor((overallPickNumber - 1) / teamCount) + 1;
  const pickIndex = (overallPickNumber - 1) % teamCount;
  return round % 2 === 1 ? pickIndex : teamCount - pickIndex - 1;
}

/** One console line per pick, shaped so it can be read against the draft board
 *  on screen: round, pick-in-round, overall number, team, player. */
export function formatPickLine({ overallPickNumber, teamCount, teamName, playerName }) {
  const round = Math.floor((overallPickNumber - 1) / teamCount) + 1;
  const pickInRound = ((overallPickNumber - 1) % teamCount) + 1;
  const padded = String(pickInRound).padStart(2, "0");
  return `R${round}.${padded}  overall ${overallPickNumber}  →  ${teamName} picks ${playerName}`;
}

/** Cleanup must be able to find this script's users without a prior run's
 *  bookkeeping, and must never match a real account. */
export function isSimEmail(email) {
  return typeof email === "string" && email.startsWith(SIM_EMAIL_PREFIX);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/simDraft.test.ts`
Expected: PASS (10 assertions across 3 describes)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/simDraft.mjs tests/unit/simDraft.test.ts
git commit -m "Add pure helpers for the draft simulation"
```

---

### Task 2: Script scaffold and standalone cleanup

Cleanup comes first so that every later task can be run and undone safely.

**Files:**
- Create: `scripts/sim-draft.mjs`
- Modify: `package.json` (scripts section)

**Interfaces:**
- Consumes: `SIM_EMAIL_PREFIX`, `isSimEmail` from Task 1
- Produces: `npm run sim:draft` and `npm run sim:draft -- --cleanup-only`

- [ ] **Step 1: Write the scaffold**

Create `scripts/sim-draft.mjs`:

```js
import assert from "node:assert/strict";
import readline from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { SIM_EMAIL_PREFIX, isSimEmail, snakeTeamIndex, formatPickLine } from "./lib/simDraft.mjs";

const TEAM_COUNT = 10;
const ROUNDS = 15;
const PICK_COUNT = TEAM_COUNT * ROUNDS;
const PICK_DELAY_MS = 5000;
const SIM_SEASON_YEAR = 2999;

/** The league's real draft. Guarded against explicitly: 150 simulated picks
 *  would destroy it. */
const PROTECTED_DRAFT_ID = "bed6865c-2795-4ef9-823f-d4f031f841c5";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and a Supabase secret key are required. Run via: npm run sim:draft"
  );
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function createPublicClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function selectRows(query, description) {
  const { data, error } = await query;
  if (error) throw error;
  assert.ok(data, `${description} returned no data.`);
  return data;
}

async function prompt(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(message);
  rl.close();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Removes everything this script creates, whether or not the run that created
 *  it finished. Safe to run repeatedly. */
async function cleanup({ draftId, seasonId, leagueId } = {}) {
  const removed = { drafts: 0, seasons: 0, members: 0, users: 0 };

  if (draftId) {
    assert.notEqual(draftId, PROTECTED_DRAFT_ID, "Refusing to delete the league's real draft.");
    await admin.from("drafts").delete().eq("id", draftId);
    removed.drafts += 1;
  }

  if (seasonId) {
    await admin.from("league_seasons").delete().eq("id", seasonId);
    removed.seasons += 1;
  }

  // Any stray simulated season from an interrupted run.
  if (leagueId) {
    const { data: strays } = await admin
      .from("league_seasons")
      .select("id,draft_id")
      .eq("league_id", leagueId)
      .eq("year", SIM_SEASON_YEAR);
    for (const stray of strays ?? []) {
      if (stray.draft_id && stray.draft_id !== PROTECTED_DRAFT_ID) {
        await admin.from("drafts").delete().eq("id", stray.draft_id);
        removed.drafts += 1;
      }
      await admin.from("league_seasons").delete().eq("id", stray.id);
      removed.seasons += 1;
    }
  }

  // Simulated users, found by email prefix so no bookkeeping is needed.
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of listed?.users ?? []) {
    if (!isSimEmail(user.email)) continue;
    await admin.from("league_members").delete().eq("user_id", user.id);
    removed.members += 1;
    await admin.auth.admin.deleteUser(user.id);
    removed.users += 1;
  }

  return removed;
}

const cleanupOnly = process.argv.includes("--cleanup-only");

if (cleanupOnly) {
  const league = await selectRows(
    admin.from("leagues").select("id,name").limit(1).single(),
    "league"
  );
  const removed = await cleanup({ leagueId: league.id });
  console.log(`Cleanup complete: ${JSON.stringify(removed)}`);
  process.exit(0);
}

console.log("Simulation not implemented yet.");
```

- [ ] **Step 2: Add the npm scripts**

In `package.json`, after the existing `"test:full-draft"` line, add:

```json
    "sim:draft": "node --env-file=.env.local scripts/sim-draft.mjs",
```

- [ ] **Step 3: Verify cleanup runs against a clean database**

Run: `npm run sim:draft -- --cleanup-only`
Expected: prints `Cleanup complete: {"drafts":0,"seasons":0,"members":0,"users":0}` and exits 0. Nothing was created yet, so nothing should be removed. A non-zero count here means the database already holds strays and is worth investigating before continuing.

Run: `npx vitest --run tests/unit/simDraft.test.ts`
Expected: PASS — the helpers are imported by the script now, so this catches a broken import path.

- [ ] **Step 4: Commit**

```bash
git add scripts/sim-draft.mjs package.json
git commit -m "Add draft simulation scaffold with standalone cleanup"
```

---

### Task 3: Create the draft and seat the participants

**Files:**
- Modify: `scripts/sim-draft.mjs`

**Interfaces:**
- Consumes: `rpc`, `selectRows`, `cleanup`, `prompt` from Task 2
- Produces: a started draft with 10 assigned participants, ready for picks

- [ ] **Step 1: Replace the placeholder with setup**

Replace the final `console.log("Simulation not implemented yet.");` with:

```js
const createdUserIds = [];
let draftId = null;
let seasonId = null;
let leagueId = null;

async function createSimUser(client, displayName) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `${SIM_EMAIL_PREFIX}${suffix}@example.com`;
  const password = `Sim-${suffix}-Aa!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError || !created.user) throw createError ?? new Error("User creation returned no user.");
  createdUserIds.push(created.user.id);

  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session) throw signInError ?? new Error("Sign-in returned no session.");
  return created.user;
}

try {
  const league = await selectRows(
    admin.from("leagues").select("id,name,slug").limit(1).single(),
    "league"
  );
  leagueId = league.id;
  console.log(`League: ${league.name}`);

  // One simulated co-commissioner. create_league_draft guards on
  // is_league_commissioner, which reads auth.uid(), so the service role cannot
  // create the draft itself. This row is removed during teardown.
  const clients = Array.from({ length: TEAM_COUNT }, createPublicClient);
  const commissioner = await createSimUser(clients[0], "Sim Commissioner");
  // league_members has no display_name column — the optional label is `nickname`
  // (verified against the live schema). `co-commissioner` is a permitted role.
  const { error: memberError } = await admin.from("league_members").insert({
    league_id: leagueId,
    user_id: commissioner.id,
    role: "co-commissioner",
    nickname: "Sim Commissioner",
  });
  if (memberError) throw memberError;

  const season = await rpc(clients[0], "create_league_season_draft", {
    p_league_id: leagueId,
    p_year: SIM_SEASON_YEAR,
    p_season_name: `Simulation ${SIM_SEASON_YEAR}`,
    p_draft_name: `SIMULATION — safe to delete (${new Date().toISOString()})`,
    p_team_count: TEAM_COUNT,
    p_rounds: ROUNDS,
    p_display_name: "Sim Commissioner",
  });
  assert.ok(season?.id, "create_league_season_draft returned no season.");
  assert.ok(season?.draft_id, "create_league_season_draft returned no draft id.");
  seasonId = season.id;
  draftId = season.draft_id;
  assert.notEqual(draftId, PROTECTED_DRAFT_ID, "Simulation must not run on the league's real draft.");

  const draft = await selectRows(
    admin.from("drafts").select("id,join_code,status").eq("id", draftId).single(),
    "draft"
  );

  const teams = await selectRows(
    admin.from("teams").select("id,name,draft_position").eq("draft_id", draftId).order("draft_position"),
    "teams"
  );
  assert.equal(teams.length, TEAM_COUNT, `Expected ${TEAM_COUNT} teams, got ${teams.length}.`);
  console.log(`Teams seeded from the league: ${teams.map((t) => t.name).join(", ")}`);

  // Seat the commissioner, then one owner per remaining team. Participants are
  // inserted directly: join_draft would also add each of them to the real
  // league's member list.
  const participantRows = [{
    draft_id: draftId,
    user_id: commissioner.id,
    display_name: "Sim Commissioner",
    role: "commissioner",
  }];
  for (let index = 1; index < TEAM_COUNT; index += 1) {
    const owner = await createSimUser(clients[index], `Sim Owner ${index + 1}`);
    participantRows.push({
      draft_id: draftId,
      user_id: owner.id,
      display_name: `Sim Owner ${index + 1}`,
      role: "owner",
    });
  }

  await admin.from("draft_participants").delete().eq("draft_id", draftId);
  const { error: participantError } = await admin.from("draft_participants").insert(participantRows);
  if (participantError) throw participantError;

  const participants = await selectRows(
    admin.from("draft_participants").select("id,user_id").eq("draft_id", draftId),
    "participants"
  );
  assert.equal(participants.length, TEAM_COUNT, "Expected one participant per team.");

  // createdUserIds[i] corresponds to clients[i]: the commissioner was created
  // first, then owners 2..10 in order, each signed in on its own client.
  for (let index = 0; index < TEAM_COUNT; index += 1) {
    const participant = participants.find((p) => p.user_id === createdUserIds[index]);
    assert.ok(participant, `Participant ${index + 1} missing.`);
    await rpc(clients[0], "assign_team", {
      p_draft_id: draftId,
      p_participant_id: participant.id,
      p_team_id: teams[index].id,
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.drafthq.net";
  console.log("");
  console.log(`  Draft room:  ${siteUrl}/draft?draftId=${draftId}`);
  console.log(`  Join code:   ${draft.join_code}`);
  console.log("");
  await prompt("Open the draft room, then press Enter to start the simulation… ");

  await rpc(clients[0], "start_draft", { p_draft_id: draftId });
  console.log("Draft started.\n");
} catch (err) {
  console.error(err);
  await cleanup({ draftId, seasonId, leagueId });
  process.exit(1);
}
```

Note: the pick loop in Task 4 indexes `clients` directly by team index, so no user-to-client map is needed.

- [ ] **Step 2: Verify setup and immediately clean up**

Run: `npm run sim:draft`

Expected: it prints the league name, the ten seeded team names (your real team names, e.g. "Team 8"), the draft URL, and a join code, then waits at the prompt. Open the URL and confirm the lobby shows your real team logos.

Then press Ctrl-C without continuing, and run:

Run: `npm run sim:draft -- --cleanup-only`
Expected: reports non-zero counts — the draft, the season, the member row, and the ten users are removed.

Verify nothing of yours was touched:

Run: `npm run sim:draft -- --cleanup-only`
Expected: all counts back to 0 on the second run.

- [ ] **Step 3: Commit**

```bash
git add scripts/sim-draft.mjs
git commit -m "Create the simulated draft and seat its participants"
```

---

### Task 4: Paced picks, assertions, and teardown

**Files:**
- Modify: `scripts/sim-draft.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–3
- Produces: the complete runnable simulation

- [ ] **Step 1: Add the pick loop, assertions, and teardown**

Replace the `console.log("Draft started.\n");` line with the following, keeping it inside the same `try`:

```js
  console.log("Draft started.\n");

  const players = await selectRows(
    admin.from("players").select("id,name").limit(400),
    "players"
  );
  assert.ok(players.length >= PICK_COUNT, `Need ${PICK_COUNT} players, found ${players.length}.`);

  // Shuffle so each run drafts a different board.
  for (let i = players.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }

  for (let overall = 1; overall <= PICK_COUNT; overall += 1) {
    const teamIndex = snakeTeamIndex(overall, TEAM_COUNT);
    const player = players[overall - 1];
    await rpc(clients[teamIndex], "make_pick", {
      p_draft_id: draftId,
      p_player_id: player.id,
      p_expected_pick: overall,
    });
    console.log(
      formatPickLine({
        overallPickNumber: overall,
        teamCount: TEAM_COUNT,
        teamName: teams[teamIndex].name,
        playerName: player.name,
      })
    );
    if (overall < PICK_COUNT) await sleep(PICK_DELAY_MS);
  }

  const [completedDraft, completedPicks] = await Promise.all([
    selectRows(
      admin.from("drafts").select("current_pick,status").eq("id", draftId).single(),
      "completed draft"
    ),
    selectRows(
      admin.from("picks").select("team_id,player_id,overall_pick_number").eq("draft_id", draftId).order("overall_pick_number"),
      "completed picks"
    ),
  ]);

  const expectedTeamIds = Array.from(
    { length: PICK_COUNT },
    (_, index) => teams[snakeTeamIndex(index + 1, TEAM_COUNT)].id
  );
  const mismatches = completedPicks
    .map((pick, index) => (pick.team_id === expectedTeamIds[index] ? null : pick.overall_pick_number))
    .filter((n) => n !== null);

  assert.equal(completedPicks.length, PICK_COUNT, `Expected ${PICK_COUNT} picks, got ${completedPicks.length}.`);
  assert.deepEqual(mismatches, [], `Picks landed on the wrong team at: ${mismatches.join(", ")}`);
  assert.equal(
    new Set(completedPicks.map((p) => p.player_id)).size,
    PICK_COUNT,
    "The same player was drafted more than once."
  );
  assert.equal(completedDraft.status, "complete", `Draft status is ${completedDraft.status}, expected complete.`);
  assert.equal(completedDraft.current_pick, PICK_COUNT + 1, `current_pick is ${completedDraft.current_pick}, expected ${PICK_COUNT + 1}.`);

  console.log("");
  console.log(`✓ ${PICK_COUNT} picks, snake order correct, all players distinct, draft complete.`);
  console.log("");
  await prompt("Inspect the finished board, then press Enter to delete the simulation… ");
} catch (err) {
  console.error(err);
  await cleanup({ draftId, seasonId, leagueId });
  process.exit(1);
}

const removed = await cleanup({ draftId, seasonId, leagueId });
console.log(`Cleaned up: ${JSON.stringify(removed)}`);
```

Delete the now-duplicated `catch` block that Task 3 added — there must be exactly one `try`/`catch`, with the cleanup call after it.

- [ ] **Step 2: Verify the helpers still pass**

Run: `npx vitest --run tests/unit/simDraft.test.ts`
Expected: PASS

Run: `npm test -- --run`
Expected: check the "Test Files" line reads all files passed. A file that crashes on import contributes no test results, so a healthy test count can hide a failing file.

- [ ] **Step 3: Run the simulation end to end**

Run: `npm run sim:draft`

This takes roughly 13 minutes. Watch the draft room while it runs and confirm:
- each pick appears on the board against the team named in the console
- the snake turns at picks 10→11, 20→21, and so on — the same team picks twice in a row
- the walk-up player behaves as expected

At the end it prints the summary and waits. Inspect the board, press Enter, and confirm the cleanup line reports the draft, season, member row, and ten users removed.

Then confirm your real data survived: open the league, check the roster still lists your ten teams with no extra members, and that the real "2026 Draft" is still there in `setup`.

- [ ] **Step 4: Commit**

```bash
git add scripts/sim-draft.mjs
git commit -m "Run and verify the watchable draft simulation"
```

---

## Known Risks

- The script writes to production. It creates only a disposable season, draft,
  ten users, and one `league_members` row, and never updates a pre-existing row.
- A Ctrl-C between setup and teardown strands those rows until
  `npm run sim:draft -- --cleanup-only` runs. That is why cleanup landed in
  Task 2, before anything could create strays.
- `cleanup` deletes every auth user whose email starts with `sim-draft-`. That
  prefix must never be used for a real account.
- The run takes ~13 minutes of wall clock. It is a human-watched rehearsal, not
  something to put in CI; `test-full-draft.mjs` remains the fast check.
