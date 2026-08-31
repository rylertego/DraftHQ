# Watchable Draft Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A script that runs a full 15-round draft inside the real league at a watchable pace, so the commissioner can see every pick land on the right team, then verify snake order and completion before deleting everything it created.

**Architecture:** Pure decision logic lives in `scripts/lib/simDraft.mjs` and is unit-tested with vitest. The orchestration script `scripts/sim-draft.mjs` does the I/O. **Every write goes through a SECURITY DEFINER RPC called by an authenticated commissioner** — this database grants no INSERT/UPDATE/DELETE on `drafts`, `teams`, or `draft_participants` to any role, including `service_role`. The service role is used only for creating auth users, reading, and writing `league_members`.

**Tech Stack:** Node ESM (`.mjs`), `@supabase/supabase-js`, `node:assert/strict`, `node:readline`, Vitest 4.

## REVISION NOTE — read before implementing

Version 1 of this plan assumed the service role could insert `draft_participants`
and delete `drafts`. That is false, and it caused a failed run that left orphaned
rows in the production database. The facts below were verified directly against
the live project and supersede any contrary instinct:

| Table | `service_role` | `authenticated` |
| --- | --- | --- |
| `drafts` | SELECT only | SELECT only |
| `teams` | SELECT only | SELECT only |
| `draft_participants` | SELECT only | SELECT only |
| `league_seasons` | SELECT only | SELECT, INSERT, UPDATE, DELETE |
| `league_members` | SELECT, INSERT, DELETE | SELECT, INSERT, UPDATE, DELETE |

Consequences, all of which this revision bakes in:

- Participants are seated with the `join_draft` RPC, not a direct insert.
- The draft is deleted with the `reset_season_draft(p_season_id)` RPC as an
  authenticated commissioner, which cascades to teams, picks, and participants.
- `join_draft` adds each joiner to the league's member list. That is now
  acceptable **because `league_members` rows can be deleted**, which was not true
  of `drafts`. Teardown removes them.
- `is_league_commissioner` recognises only role `'commissioner'` — NOT
  `'co-commissioner'`.
- `league_seasons.year` has a `[2000, 2100]` CHECK, so the sentinel year is
  `2100`, not `2999`.
- CAPTCHA protection is enabled on Auth, so `signInWithPassword` is refused for
  headless scripts. Sessions come from `admin.auth.admin.generateLink` +
  `client.auth.verifyOtp({ type: "email" })`, which is confirmed working.

## Global Constraints

- Runs against PRODUCTION Supabase. It may create only: one `league_seasons` row
  (year 2100), one draft (via RPC), ten auth users with `sim-draft-` emails, the
  `league_members` rows `join_draft` creates, and the participants `join_draft`
  creates. It must never UPDATE or DELETE any pre-existing league, league team,
  walk-up song, or draft.
- It must never touch the real draft `bed6865c-2795-4ef9-823f-d4f031f841c5`.
- Never print a Supabase key or an auth token.
- Node ESM `.mjs` under `scripts/`; follow `scripts/test-full-draft.mjs` for
  `rpc()` and `selectRows()` shapes.
- Secrets come from `.env.local` via `node --env-file=.env.local`.
- Vitest tests live in `tests/unit/`; no jsdom, no event firing.
- 10 teams, 15 rounds, 150 picks, ~5 seconds per pick.
- Commit after every task.

---

### Task 1: Pure simulation helpers — ALREADY COMPLETE

Committed as `5a56b98`. `scripts/lib/simDraft.mjs` exports `SIM_EMAIL_PREFIX`,
`isSimEmail`, `snakeTeamIndex`, and `formatPickLine`, with tests in
`tests/unit/simDraft.test.ts`. Do not redo it.

---

### Task 2: Rewrite setup and teardown on the RPC path

The scaffold from commit `eacce8a` exists but its `cleanup()` cannot work — it
deletes from `drafts` and `league_seasons` as the service role, which is denied.
This task replaces the whole authentication/setup/teardown core.

**Files:**
- Modify: `scripts/sim-draft.mjs`

**Interfaces:**
- Consumes: `SIM_EMAIL_PREFIX`, `isSimEmail` from Task 1
- Produces: `createSimUser(client, displayName)`, `ensureCommissioner(client)`, `cleanup({ seasonId, leagueId })`, and a working `--cleanup-only` path

- [ ] **Step 1: Replace user creation with admin-minted sessions**

Replace the whole `createSimUser` function (or add it if the scaffold lacks one)
with:

```js
/** CAPTCHA protection is enabled on this project, so signInWithPassword is
 *  refused for a headless script. An admin-generated link carries a
 *  server-minted token, which verifyOtp accepts without a captcha. No password
 *  is ever created or used. */
async function createSimUser(client, displayName) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `${SIM_EMAIL_PREFIX}${suffix}@example.com`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError || !created.user) throw createError ?? new Error("User creation returned no user.");

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    throw linkError ?? new Error("generateLink returned no token.");
  }

  const { data: session, error: verifyError } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (verifyError || !session.session) throw verifyError ?? new Error("verifyOtp returned no session.");

  return created.user;
}
```

- [ ] **Step 2: Add the commissioner helper**

`create_league_season_draft` and `reset_season_draft` both require
`is_league_commissioner`, which reads `auth.uid()` and accepts ONLY the role
`'commissioner'`. Add:

```js
/** Seats a signed-in sim user as a league commissioner so it can call the
 *  draft RPCs. league_members is one of the few tables the service role may
 *  write, which is what makes this possible at all. */
async function ensureCommissioner(userId, leagueId) {
  const { error } = await admin.from("league_members").upsert(
    { league_id: leagueId, user_id: userId, role: "commissioner", nickname: "Sim Commissioner" },
    { onConflict: "league_id,user_id" }
  );
  if (error) throw error;
}
```

- [ ] **Step 3: Rewrite cleanup on the RPC path**

Replace the entire `cleanup` function with:

```js
/** Teardown runs as an authenticated commissioner, because drafts, teams, and
 *  draft_participants are SELECT-only for every role — all writes go through
 *  SECURITY DEFINER RPCs. reset_season_draft deletes the draft and cascades to
 *  teams, picks, and participants. Safe to run repeatedly. */
async function cleanup({ leagueId } = {}) {
  const removed = { drafts: 0, seasons: 0, members: 0, users: 0 };
  if (!leagueId) return removed;

  // Find leftover simulated seasons. Reading is permitted for the service role.
  const { data: seasons, error: seasonReadError } = await admin
    .from("league_seasons")
    .select("id,draft_id")
    .eq("league_id", leagueId)
    .eq("year", SIM_SEASON_YEAR);
  if (seasonReadError) throw seasonReadError;

  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const simUsers = (listed?.users ?? []).filter((u) => isSimEmail(u.email));

  if ((seasons ?? []).length > 0) {
    // Deleting a draft needs an authenticated commissioner. Reuse a leftover sim
    // user if one exists, otherwise mint one just for the teardown.
    const client = createPublicClient();
    let janitorId;
    if (simUsers.length > 0) {
      const email = simUsers[0].email;
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (linkError || !link?.properties?.hashed_token) throw linkError ?? new Error("generateLink returned no token.");
      const { data: session, error: verifyError } = await client.auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: "email",
      });
      if (verifyError || !session.session) throw verifyError ?? new Error("verifyOtp returned no session.");
      janitorId = simUsers[0].id;
    } else {
      const janitor = await createSimUser(client, "Sim Janitor");
      janitorId = janitor.id;
    }
    await ensureCommissioner(janitorId, leagueId);

    for (const season of seasons) {
      if (season.draft_id === PROTECTED_DRAFT_ID) {
        throw new Error("A simulated season points at the real draft — refusing to reset it.");
      }
      await rpc(client, "reset_season_draft", { p_season_id: season.id });
      if (season.draft_id) removed.drafts += 1;

      const { data: deletedSeasons, error: seasonDeleteError } = await client
        .from("league_seasons")
        .delete()
        .eq("id", season.id)
        .select("id");
      if (seasonDeleteError) throw seasonDeleteError;
      removed.seasons += deletedSeasons?.length ?? 0;
    }
  }

  // Re-list: the janitor may have been created above.
  const { data: relisted, error: relistError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (relistError) throw relistError;

  for (const user of relisted?.users ?? []) {
    if (!isSimEmail(user.email)) continue;
    const { data: deletedMembers, error: memberError } = await admin
      .from("league_members")
      .delete()
      .eq("user_id", user.id)
      .select("id");
    if (memberError) throw memberError;
    removed.members += deletedMembers?.length ?? 0;

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw deleteUserError;
    removed.users += 1;
  }

  return removed;
}
```

Also change the constant near the top:

```js
const SIM_SEASON_YEAR = 2100; // league_seasons.year has a [2000, 2100] CHECK
```

And make `--cleanup-only` pass the league id, which it already looks up:

```js
  const removed = await cleanup({ leagueId: league.id });
```

- [ ] **Step 4: Verify cleanup against a clean database**

Run: `npm run sim:draft -- --cleanup-only`
Expected: `Cleanup complete: {"drafts":0,"seasons":0,"members":0,"users":0}`, exit 0.

This still proves little on its own — Task 3's verification is where cleanup is
proven against real rows. Note that honestly in the report rather than claiming
cleanup is verified.

Run: `npx vitest --run tests/unit/simDraft.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim-draft.mjs
git commit -m "Move simulation setup and teardown onto the RPC path"
```

---

### Task 3: Create the draft and seat the participants

**Files:**
- Modify: `scripts/sim-draft.mjs`

**Interfaces:**
- Consumes: `createSimUser`, `ensureCommissioner`, `cleanup` from Task 2
- Produces: a started draft with ten assigned participants, ready for picks

- [ ] **Step 1: Replace the placeholder with setup**

Replace the trailing `console.log("Simulation not implemented yet.");` with:

```js
let seasonId = null;
let draftId = null;
let leagueId = null;

try {
  const league = await selectRows(
    admin.from("leagues").select("id,name,slug").limit(1).single(),
    "league"
  );
  leagueId = league.id;
  console.log(`League: ${league.name}`);

  const clients = Array.from({ length: TEAM_COUNT }, createPublicClient);

  const commissioner = await createSimUser(clients[0], "Sim Commissioner");
  await ensureCommissioner(commissioner.id, leagueId);

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

  // join_draft is the only way to create a participant — draft_participants is
  // SELECT-only for every role. It also adds each joiner to the league's member
  // list, which teardown removes.
  for (let index = 1; index < TEAM_COUNT; index += 1) {
    await createSimUser(clients[index], `Sim Owner ${index + 1}`);
    await rpc(clients[index], "join_draft", {
      p_join_code: draft.join_code,
      p_display_name: `Sim Owner ${index + 1}`,
    });
  }

  const participants = await selectRows(
    admin.from("draft_participants").select("id,user_id,display_name").eq("draft_id", draftId),
    "participants"
  );
  assert.equal(participants.length, TEAM_COUNT, `Expected ${TEAM_COUNT} participants, got ${participants.length}.`);

  // clients[i] holds the session for the user seated at teams[i].
  const orderedUserIds = [commissioner.id];
  for (let index = 1; index < TEAM_COUNT; index += 1) {
    const { data: sessionUser } = await clients[index].auth.getUser();
    orderedUserIds.push(sessionUser.user.id);
  }

  for (let index = 0; index < TEAM_COUNT; index += 1) {
    const participant = participants.find((p) => p.user_id === orderedUserIds[index]);
    assert.ok(participant, `Participant for client ${index} not found.`);
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
  await cleanup({ leagueId });
  process.exit(1);
}
```

- [ ] **Step 2: Verify setup AND prove cleanup works on real rows**

This is where cleanup is actually proven. Run all three, and run the second even
if the first fails:

1. `timeout 180 npm run sim:draft`
   Expected: prints the league name, ten seeded team names (your real team names),
   a draft URL, and a join code.
2. `npm run sim:draft -- --cleanup-only`
   Expected: **NON-ZERO** counts — the draft, the season, the member rows, and the
   sim users are removed. This is the real test of Task 2's cleanup.
3. `npm run sim:draft -- --cleanup-only`
   Expected: all zeros, proving cleanup is idempotent.

If step 3 does not return all zeros, STOP and report BLOCKED with the exact
counts. Leftover rows in a production database are the one unacceptable outcome.

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

Replace `console.log("Draft started.\n");` with the following, keeping it inside
the same `try`:

```js
  console.log("Draft started.\n");

  const players = await selectRows(
    admin.from("players").select("id,name").limit(400),
    "players"
  );
  assert.ok(players.length >= PICK_COUNT, `Need ${PICK_COUNT} players, found ${players.length}.`);

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
  await cleanup({ leagueId });
  process.exit(1);
}

const removed = await cleanup({ leagueId });
console.log(`Cleaned up: ${JSON.stringify(removed)}`);
```

There must be exactly one `try`/`catch`, with the final cleanup after it.

- [ ] **Step 2: Verify the suite**

Run: `npm test -- --run`
Expected: check the "Test Files" line reads all files passed. A file that crashes
on import contributes no results, so a healthy test count can hide a failing file.

- [ ] **Step 3: Hand the end-to-end run to the plan owner**

The full run takes ~13 minutes and pauses twice for a keypress, so it needs a
human at the terminal. Do NOT run it to completion yourself. Report that Task 4
is code-complete and ready for a supervised run.

- [ ] **Step 4: Commit**

```bash
git add scripts/sim-draft.mjs
git commit -m "Add the paced pick loop, assertions, and teardown"
```

---

## Known Risks

- The script writes to production. It creates only a disposable season, a draft
  (via RPC), ten users, and league-member rows, and never updates a pre-existing
  row.
- A Ctrl-C between setup and teardown strands rows until
  `npm run sim:draft -- --cleanup-only` runs. Cleanup is now on the RPC path, so
  unlike version 1 of this plan it can actually delete what it created.
- `cleanup` deletes every auth user whose email starts with `sim-draft-`. That
  prefix must never be used for a real account.
- The run takes ~13 minutes of wall clock and pauses for keypresses. It is a
  human-watched rehearsal, not a CI job.
