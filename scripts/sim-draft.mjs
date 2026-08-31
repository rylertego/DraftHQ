import assert from "node:assert/strict";
import readline from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { SIM_EMAIL_PREFIX, isSimEmail, snakeTeamIndex, formatPickLine } from "./lib/simDraft.mjs";

const TEAM_COUNT = 10;
const ROUNDS = 15;
const PICK_COUNT = TEAM_COUNT * ROUNDS;
const PICK_DELAY_MS = 5000;
const SIM_SEASON_YEAR = 2100; // league_seasons.year has a [2000, 2100] CHECK

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

/** Both setup and standalone cleanup must resolve the SAME league. Without an
 *  explicit order, Postgres may return a different row to each, which would
 *  strand a simulated draft that cleanup then cannot find. */
async function resolveLeague() {
  return selectRows(
    admin.from("leagues").select("id,name,slug").order("created_at", { ascending: true }).limit(1).single(),
    "league"
  );
}

async function prompt(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(message);
  rl.close();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** Seats a signed-in sim user as a league commissioner so it can call the
 *  draft RPCs. league_members is one of the few tables the service role may
 *  write, which is what makes this possible at all. Delete-then-insert rather
 *  than upsert: service_role has INSERT/DELETE/SELECT on league_members but
 *  no UPDATE, so an upsert's ON CONFLICT DO UPDATE would throw the moment a
 *  row already exists (e.g. a sim user already seated as a plain member). */
async function ensureCommissioner(userId, leagueId) {
  const { error: deleteError } = await admin
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await admin.from("league_members").insert({
    league_id: leagueId,
    user_id: userId,
    role: "commissioner",
    nickname: "Sim Commissioner",
  });
  if (insertError) throw insertError;
}

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

  try {
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
  } finally {
    // Even if season teardown threw above, any janitor minted or re-seated as
    // commissioner must not be left behind in production. This pass always
    // runs; the original error (if any) still propagates after it completes.
    const { data: relisted, error: relistError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (relistError) throw relistError;

    for (const user of relisted?.users ?? []) {
      // Bare prefix match on the email local part — a real account registered
      // as sim-draft-*@... would be deleted here too. Acceptable only because
      // this is a controlled sim script, not general-purpose user cleanup.
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
  }

  return removed;
}

const cleanupOnly = process.argv.includes("--cleanup-only");

if (cleanupOnly) {
  const league = await resolveLeague();
  const removed = await cleanup({ leagueId: league.id });
  console.log(`Cleanup complete: ${JSON.stringify(removed)}`);
  process.exit(0);
}

let seasonId = null;
let draftId = null;
let leagueId = null;

try {
  const league = await resolveLeague();
  leagueId = league.id;
  console.log(`League: ${league.name}`);

  // Refuse to start a second run on top of a live one. Cleanup keys on
  // year = 2100 + the sim email prefix, so an overlapping run's failure-path
  // cleanup would delete the FIRST run's season, draft, members, and users
  // out from under it. Do not auto-clean here — a live run must not be
  // destroyed by a second invocation.
  const existingSeasons = await selectRows(
    admin.from("league_seasons").select("id").eq("league_id", leagueId).eq("year", SIM_SEASON_YEAR),
    "existing simulated seasons"
  );
  if (existingSeasons.length > 0) {
    console.error(
      `A simulated season (year ${SIM_SEASON_YEAR}) already exists for this league. ` +
      `Another run may be in progress. Run "npm run sim:draft -- --cleanup-only" first, ` +
      `then retry.`
    );
    process.exit(1);
  }

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
    admin.from("draft_participants").select("id,user_id,team_id").eq("draft_id", draftId),
    "participants"
  );

  // clients[i] holds the session for the user seated at teams[i].
  const orderedUserIds = [commissioner.id];
  for (let index = 1; index < TEAM_COUNT; index += 1) {
    const { data: sessionUser } = await clients[index].auth.getUser();
    orderedUserIds.push(sessionUser.user.id);
  }

  // Do not assert participants.length === TEAM_COUNT: league teams with a
  // continuing owner_user_id are auto-seated into every new season's draft by
  // materialize_league_season, so the participant count exceeds TEAM_COUNT
  // whenever the league already has owned teams (as this one does). What
  // matters is that each of THIS run's ten clients has a seat to assign —
  // extras belong to real owners and disappear when the draft is deleted.
  const simParticipants = orderedUserIds.map((userId) =>
    participants.find((p) => p.user_id === userId)
  );
  simParticipants.forEach((participant, index) => {
    assert.ok(participant, `No participant found for simulated client ${index}.`);
  });

  const extras = participants.length - TEAM_COUNT;
  if (extras > 0) {
    console.log(
      `Note: ${extras} continuing owner(s) were auto-seated by materialize_league_season. ` +
      `Their teams are reassigned to simulated owners for this run, and every participant ` +
      `row goes away when the draft is deleted.`
    );
  }

  // Continuing owners are auto-seated WITH their team already assigned, and
  // assign_team has no reassign mode — it raises 23505 on an occupied team.
  // p_team_id: null is a supported unassign, so release those teams first.
  // This only ever touches the throwaway simulated draft; the league team and
  // its real owner_user_id are untouched.
  const simUserIds = new Set(orderedUserIds);
  for (const participant of participants) {
    if (!participant.team_id || simUserIds.has(participant.user_id)) continue;
    await rpc(clients[0], "assign_team", {
      p_draft_id: draftId,
      p_participant_id: participant.id,
      p_team_id: null,
    });
    console.log(`Released a team held by a continuing owner for this simulated draft.`);
  }

  for (let index = 0; index < TEAM_COUNT; index += 1) {
    const participant = simParticipants[index];
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
  console.log(
    "  If you abort with Ctrl-C, a simulated commissioner remains in the league's " +
    "member list until you run \"npm run sim:draft -- --cleanup-only\"."
  );
  console.log("");
  await prompt("Open the draft room, then press Enter to start the simulation… ");

  await rpc(clients[0], "start_draft", { p_draft_id: draftId });
  console.log("Draft started.\n");

  // players and picks grant SELECT to `authenticated` only — the service role
  // has no read on either, so these two reads must use a signed-in client.
  const players = await selectRows(
    clients[0].from("players").select("id,full_name").eq("active", true).limit(400),
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
        playerName: player.full_name,
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
      clients[0].from("picks").select("team_id,player_id,overall_pick_number").eq("draft_id", draftId).order("overall_pick_number"),
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
  console.log(`✓ ${PICK_COUNT} picks, server accepted all picks in snake order, all players distinct, draft complete.`);
  console.log("");
  await prompt("Inspect the finished board, then press Enter to delete the simulation… ");
} catch (err) {
  console.error(err);
  await cleanup({ leagueId });
  process.exit(1);
}

const removed = await cleanup({ leagueId });
console.log(`Cleaned up: ${JSON.stringify(removed)}`);
