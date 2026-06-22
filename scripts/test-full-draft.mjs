import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const TEAM_COUNT = 12;
const ROUNDS = 15;
const PICK_COUNT = TEAM_COUNT * ROUNDS;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, and a Supabase secret key are required."
  );
}

function createPublicClient() {
  return createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const clients = Array.from({ length: TEAM_COUNT }, createPublicClient);
const createdUserIds = [];
let draftId = null;

async function createUserAndSignIn(client, displayName) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `full-draft-${suffix}@example.com`;
  const password = `Test-${suffix}-Aa!`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

  if (createError || !created.user) {
    throw createError ?? new Error("Test user creation returned no user.");
  }

  createdUserIds.push(created.user.id);
  const { data: signedIn, error: signInError } =
    await client.auth.signInWithPassword({ email, password });

  if (signInError || !signedIn.session) {
    throw signInError ?? new Error("Test user sign-in returned no session.");
  }

  return created.user;
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

async function selectRows(query, description) {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  assert.ok(data, `${description} returned no data.`);
  return data;
}

function getTeamIndex(overallPickNumber) {
  const round = Math.floor((overallPickNumber - 1) / TEAM_COUNT) + 1;
  const pickIndex = (overallPickNumber - 1) % TEAM_COUNT;
  return round % 2 === 1 ? pickIndex : TEAM_COUNT - pickIndex - 1;
}

const startedAt = Date.now();

try {
  const users = [];
  for (let index = 0; index < TEAM_COUNT; index += 1) {
    users.push(
      await createUserAndSignIn(
        clients[index],
        index === 0 ? "Load Commissioner" : `Load Owner ${index + 1}`
      )
    );
  }

  const draft = await rpc(clients[0], "create_draft", {
    p_name: `Full Draft Rehearsal ${Date.now()}`,
    p_team_count: TEAM_COUNT,
    p_rounds: ROUNDS,
    p_display_name: "Load Commissioner",
  });
  assert.ok(draft?.id, "create_draft did not return an ID.");
  draftId = draft.id;

  for (let index = 1; index < TEAM_COUNT; index += 1) {
    await rpc(clients[index], "join_draft", {
      p_join_code: draft.join_code,
      p_display_name: `Load Owner ${index + 1}`,
    });
  }

  const [teams, participants, players] = await Promise.all([
    selectRows(
      clients[0]
        .from("teams")
        .select("id,draft_position")
        .eq("draft_id", draftId)
        .order("draft_position"),
      "teams"
    ),
    selectRows(
      clients[0]
        .from("draft_participants")
        .select("id,user_id")
        .eq("draft_id", draftId),
      "participants"
    ),
    selectRows(
      clients[0]
        .from("players")
        .select("id")
        .eq("active", true)
        .order("full_name")
        .limit(PICK_COUNT),
      "players"
    ),
  ]);

  assert.equal(teams.length, TEAM_COUNT, "Expected twelve teams.");
  assert.equal(participants.length, TEAM_COUNT, "Expected twelve participants.");
  assert.equal(
    players.length,
    PICK_COUNT,
    `At least ${PICK_COUNT} active players are required.`
  );

  for (let index = 0; index < TEAM_COUNT; index += 1) {
    const participant = participants.find(
      (current) => current.user_id === users[index].id
    );
    assert.ok(participant, `Participant ${index + 1} is missing.`);
    await rpc(clients[0], "assign_team", {
      p_draft_id: draftId,
      p_participant_id: participant.id,
      p_team_id: teams[index].id,
    });
  }

  await rpc(clients[0], "start_draft", { p_draft_id: draftId });

  for (let overallPickNumber = 1; overallPickNumber <= PICK_COUNT; overallPickNumber += 1) {
    const teamIndex = getTeamIndex(overallPickNumber);
    await rpc(clients[teamIndex], "make_pick", {
      p_draft_id: draftId,
      p_player_id: players[overallPickNumber - 1].id,
      p_expected_pick: overallPickNumber,
    });
  }

  const [completedDraft, completedPicks] = await Promise.all([
    selectRows(
      clients[0]
        .from("drafts")
        .select("current_pick,status")
        .eq("id", draftId)
        .single(),
      "completed draft"
    ),
    selectRows(
      clients[0]
        .from("picks")
        .select("team_id,player_id,overall_pick_number")
        .eq("draft_id", draftId)
        .order("overall_pick_number"),
      "completed picks"
    ),
  ]);

  assert.equal(completedDraft.status, "complete");
  assert.equal(completedDraft.current_pick, PICK_COUNT + 1);
  assert.equal(completedPicks.length, PICK_COUNT);
  assert.equal(new Set(completedPicks.map((pick) => pick.player_id)).size, PICK_COUNT);
  assert.deepEqual(
    completedPicks.map((pick) => pick.team_id),
    Array.from(
      { length: PICK_COUNT },
      (_, index) => teams[getTeamIndex(index + 1)].id
    )
  );

  console.log(
    JSON.stringify(
      {
        teams: TEAM_COUNT,
        rounds: ROUNDS,
        picks: PICK_COUNT,
        uniquePlayers: PICK_COUNT,
        snakeOrder: "passed",
        completion: "passed",
        elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
      },
      null,
      2
    )
  );
} finally {
  if (draftId) {
    await admin.from("drafts").delete().eq("id", draftId);
  }

  await Promise.allSettled(
    createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId))
  );
}
