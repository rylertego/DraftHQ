import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import {
  getLocalSupabaseEnvironment,
  waitForLocalSupabaseAuth,
} from "./local-supabase-env.mjs";

const { Client } = pg;
const environment = getLocalSupabaseEnvironment();
const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
};
const admin = createClient(
  environment.API_URL,
  environment.SERVICE_ROLE_KEY,
  clientOptions
);
const database = new Client({ connectionString: environment.DB_URL });
const createdUserIds = [];
const createdDraftIds = [];
let databaseConnected = false;

function publicClient() {
  return createClient(environment.API_URL, environment.ANON_KEY, clientOptions);
}

async function createIdentity(label) {
  const client = publicClient();
  const suffix = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `race-${label}-${suffix}@example.com`;
  const password = `Race-${suffix}-Aa1!`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: label },
    });

  if (createError || !created.user) {
    throw createError ?? new Error(`Unable to create ${label}.`);
  }

  createdUserIds.push(created.user.id);
  const { data: signedIn, error: signInError } =
    await client.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.user) {
    throw signInError ?? new Error(`Unable to sign in ${label}.`);
  }

  return { client, email, user: signedIn.user };
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

async function raceRpc(operations) {
  return Promise.all(
    operations.map(async ({ client, name, args }) => {
      try {
        const { data, error } = await client.rpc(name, args);
        return { data, error };
      } catch (error) {
        return { data: null, error };
      }
    })
  );
}

function successCount(results) {
  return results.filter((result) => !result.error).length;
}

function assertFailureCodes(results, expectedCodes) {
  const actualCodes = results
    .filter((result) => result.error)
    .map((result) => result.error.code)
    .sort();
  assert.deepEqual(actualCodes, [...expectedCodes].sort());
}

async function createDraftFixture({
  commissioner,
  owners = [],
  extras = [],
  rounds = 2,
  assign = true,
  start = true,
}) {
  const draft = await rpc(commissioner.client, "create_draft", {
    p_name: `Concurrency ${createdDraftIds.length + 1}`,
    p_team_count: owners.length + 1,
    p_rounds: rounds,
    p_display_name: "commissioner",
  });
  createdDraftIds.push(draft.id);

  const joined = new Map();
  for (const identity of [...owners, ...extras]) {
    joined.set(
      identity.user.id,
      await rpc(identity.client, "join_draft", {
        p_join_code: draft.join_code,
        p_display_name: identity.user.user_metadata.display_name,
      })
    );
  }

  const teams = await database.query(
    `select id, draft_position from public.teams
      where draft_id = $1 order by draft_position`,
    [draft.id]
  );
  const participants = await database.query(
    `select id, user_id from public.draft_participants where draft_id = $1`,
    [draft.id]
  );
  const commissionerParticipant = participants.rows.find(
    (participant) => participant.user_id === commissioner.user.id
  );
  assert.ok(commissionerParticipant);

  if (assign) {
    const assignments = [
      [commissionerParticipant.id, teams.rows[0].id],
      ...owners.map((owner, index) => [
        joined.get(owner.user.id).id,
        teams.rows[index + 1].id,
      ]),
    ];
    for (const [participantId, teamId] of assignments) {
      await rpc(commissioner.client, "assign_team", {
        p_draft_id: draft.id,
        p_participant_id: participantId,
        p_team_id: teamId,
      });
    }
  }

  if (start) {
    await rpc(commissioner.client, "start_draft", { p_draft_id: draft.id });
  }

  return {
    draft,
    teams: teams.rows,
    joined,
    commissionerParticipant,
  };
}

async function readState(draftId) {
  const draft = await database.query(
    `select team_count, rounds, current_pick, status, pick_deadline_at,
      paused_remaining_seconds from public.drafts where id = $1`,
    [draftId]
  );
  const teams = await database.query(
    `select id, draft_position from public.teams where draft_id = $1`,
    [draftId]
  );
  const picks = await database.query(
    `select id, team_id, player_id, overall_pick_number from public.picks
      where draft_id = $1 order by overall_pick_number`,
    [draftId]
  );
  assert.equal(draft.rows.length, 1);
  return { draft: draft.rows[0], teams: teams.rows, picks: picks.rows };
}

async function assertDraftInvariants(draftId) {
  const state = await readState(draftId);
  const { draft, teams, picks } = state;
  assert.equal(draft.current_pick, picks.length + 1, "current_pick drifted.");
  assert.equal(
    new Set(picks.map((pick) => pick.overall_pick_number)).size,
    picks.length,
    "Duplicate overall pick numbers exist."
  );
  assert.equal(
    new Set(picks.map((pick) => pick.player_id)).size,
    picks.length,
    "Duplicate drafted players exist."
  );

  const teamByPosition = new Map(
    teams.map((team) => [team.draft_position, team.id])
  );
  for (const pick of picks) {
    const round = Math.floor((pick.overall_pick_number - 1) / draft.team_count) + 1;
    const numberInRound = ((pick.overall_pick_number - 1) % draft.team_count) + 1;
    const position =
      round % 2 === 1
        ? numberInRound
        : draft.team_count - numberInRound + 1;
    assert.equal(pick.team_id, teamByPosition.get(position), "Snake order drifted.");
  }

  if (draft.status === "active") {
    assert.ok(draft.pick_deadline_at, "Active draft has no deadline.");
    assert.equal(draft.paused_remaining_seconds, null);
  } else if (draft.status === "paused") {
    assert.equal(draft.pick_deadline_at, null);
    assert.notEqual(draft.paused_remaining_seconds, null);
  } else if (draft.status === "complete") {
    assert.equal(draft.pick_deadline_at, null);
    assert.equal(draft.paused_remaining_seconds, null);
  }

  return state;
}

async function runContracts() {
  await waitForLocalSupabaseAuth(environment);
  await database.connect();
  databaseConnected = true;

  const commissioner = await createIdentity("commissioner");
  const owner = await createIdentity("owner");
  const secondOwner = await createIdentity("second-owner");
  const invitee = await createIdentity("invitee");
  const standby = await createIdentity("standby");
  const playerResult = await database.query(
    `select id from public.players where source = 'test'
      order by external_id limit 20`
  );
  const players = playerResult.rows;

  const duplicateFixture = await createDraftFixture({
    commissioner,
    owners: [owner],
  });
  const duplicateResults = await raceRpc([
    {
      client: commissioner.client,
      name: "make_pick",
      args: {
        p_draft_id: duplicateFixture.draft.id,
        p_player_id: players[0].id,
        p_expected_pick: 1,
      },
    },
    {
      client: commissioner.client,
      name: "make_pick",
      args: {
        p_draft_id: duplicateFixture.draft.id,
        p_player_id: players[0].id,
        p_expected_pick: 1,
      },
    },
  ]);
  assert.equal(successCount(duplicateResults), 1);
  assertFailureCodes(duplicateResults, ["P0001"]);
  assert.equal((await assertDraftInvariants(duplicateFixture.draft.id)).picks.length, 1);
  console.log("PASS duplicate retry commits one pick");

  const slotFixture = await createDraftFixture({ commissioner, owners: [owner] });
  const slotResults = await raceRpc([
    {
      client: commissioner.client,
      name: "make_pick",
      args: {
        p_draft_id: slotFixture.draft.id,
        p_player_id: players[1].id,
        p_expected_pick: 1,
      },
    },
    {
      client: owner.client,
      name: "make_pick",
      args: {
        p_draft_id: slotFixture.draft.id,
        p_player_id: players[2].id,
        p_expected_pick: 1,
      },
    },
  ]);
  assert.equal(successCount(slotResults), 1);
  // When the commissioner wins the lock first the owner's expected_pick becomes stale (P0001).
  // When the owner wins the lock first they are correctly rejected by the on-the-clock check
  // before current_pick advances (42501). Both are valid safe rejections.
  const slotFailures = slotResults.filter((r) => r.error).map((r) => r.error.code);
  assert.equal(slotFailures.length, 1, "Expected exactly one failure from competing slot submissions.");
  assert.ok(
    slotFailures[0] === "P0001" || slotFailures[0] === "42501",
    `Expected P0001 (stale pick) or 42501 (not on the clock), got ${slotFailures[0]}`
  );
  assert.equal((await assertDraftInvariants(slotFixture.draft.id)).picks.length, 1);
  console.log("PASS competing slot submissions commit one pick");

  const recoveryFixture = await createDraftFixture({ commissioner, owners: [owner] });
  const recoveryResults = await raceRpc([
    {
      client: commissioner.client,
      name: "make_pick",
      args: {
        p_draft_id: recoveryFixture.draft.id,
        p_player_id: players[3].id,
        p_expected_pick: 1,
      },
    },
    {
      client: commissioner.client,
      name: "commissioner_make_pick",
      args: {
        p_draft_id: recoveryFixture.draft.id,
        p_player_id: players[4].id,
        p_expected_pick: 1,
      },
    },
  ]);
  assert.equal(
    successCount(recoveryResults),
    1,
    "Owner pick and recovery pick both committed for one observed slot."
  );
  assertFailureCodes(recoveryResults, ["P0001"]);
  assert.equal((await assertDraftInvariants(recoveryFixture.draft.id)).picks.length, 1);
  console.log("PASS owner and recovery race commits one pick");

  const pauseFixture = await createDraftFixture({ commissioner, owners: [owner] });
  await raceRpc([
    {
      client: commissioner.client,
      name: "make_pick",
      args: {
        p_draft_id: pauseFixture.draft.id,
        p_player_id: players[5].id,
        p_expected_pick: 1,
      },
    },
    {
      client: commissioner.client,
      name: "pause_draft",
      args: { p_draft_id: pauseFixture.draft.id },
    },
  ]);
  const pauseState = await assertDraftInvariants(pauseFixture.draft.id);
  assert.equal(pauseState.draft.status, "paused");
  assert.ok(pauseState.picks.length === 0 || pauseState.picks.length === 1);
  console.log("PASS pick and pause race leaves coherent paused state");

  const undoFixture = await createDraftFixture({ commissioner, owners: [owner] });
  await rpc(commissioner.client, "make_pick", {
    p_draft_id: undoFixture.draft.id,
    p_player_id: players[6].id,
    p_expected_pick: 1,
  });
  await raceRpc([
    {
      client: owner.client,
      name: "make_pick",
      args: {
        p_draft_id: undoFixture.draft.id,
        p_player_id: players[7].id,
        p_expected_pick: 2,
      },
    },
    {
      client: commissioner.client,
      name: "undo_pick",
      args: { p_draft_id: undoFixture.draft.id },
    },
  ]);
  const undoState = await assertDraftInvariants(undoFixture.draft.id);
  assert.ok(undoState.picks.length === 0 || undoState.picks.length === 1);
  console.log("PASS pick and undo race leaves coherent rewind state");

  const assignmentFixture = await createDraftFixture({
    commissioner,
    owners: [owner],
    extras: [secondOwner],
    assign: false,
    start: false,
  });
  const assignmentResults = await raceRpc([
    {
      client: commissioner.client,
      name: "assign_team",
      args: {
        p_draft_id: assignmentFixture.draft.id,
        p_participant_id: assignmentFixture.joined.get(owner.user.id).id,
        p_team_id: assignmentFixture.teams[0].id,
      },
    },
    {
      client: commissioner.client,
      name: "assign_team",
      args: {
        p_draft_id: assignmentFixture.draft.id,
        p_participant_id: assignmentFixture.joined.get(secondOwner.user.id).id,
        p_team_id: assignmentFixture.teams[0].id,
      },
    },
  ]);
  assert.equal(successCount(assignmentResults), 1);
  assertFailureCodes(assignmentResults, ["23505"]);
  const assigned = await database.query(
    `select count(*)::integer as count from public.draft_participants
      where draft_id = $1 and team_id = $2`,
    [assignmentFixture.draft.id, assignmentFixture.teams[0].id]
  );
  assert.equal(assigned.rows[0].count, 1);
  console.log("PASS assignment collision has one winner");

  const invitationFixture = await createDraftFixture({
    commissioner,
    owners: [owner],
    extras: [standby],
    assign: false,
    start: false,
  });
  const { error: invitationError } = await admin
    .from("draft_invitations")
    .insert({
      draft_id: invitationFixture.draft.id,
      email: invitee.email,
      team_id: invitationFixture.teams[0].id,
      invited_by_user_id: commissioner.user.id,
      status: "pending",
    });
  assert.equal(invitationError, null, invitationError?.message);
  const invitationResults = await raceRpc([
    {
      client: invitee.client,
      name: "join_draft",
      args: {
        p_join_code: invitationFixture.draft.join_code,
        p_display_name: "invitee",
      },
    },
    {
      client: commissioner.client,
      name: "assign_team",
      args: {
        p_draft_id: invitationFixture.draft.id,
        p_participant_id: invitationFixture.joined.get(standby.user.id).id,
        p_team_id: invitationFixture.teams[0].id,
      },
    },
  ]);
  assert.equal(successCount(invitationResults), 1);
  assertFailureCodes(invitationResults, ["23505"]);
  const claimed = await database.query(
    `select count(*)::integer as count from public.draft_participants
      where draft_id = $1 and team_id = $2`,
    [invitationFixture.draft.id, invitationFixture.teams[0].id]
  );
  assert.equal(claimed.rows[0].count, 1);
  console.log("PASS invitation claim and manual assignment have one winner");

  const startFixture = await createDraftFixture({
    commissioner,
    owners: [owner],
    start: false,
  });
  const reversedTeamIds = startFixture.teams.map((team) => team.id).reverse();
  const startResults = await raceRpc([
    {
      client: commissioner.client,
      name: "start_draft",
      args: { p_draft_id: startFixture.draft.id },
    },
    {
      client: commissioner.client,
      name: "update_team_setup",
      args: {
        p_draft_id: startFixture.draft.id,
        p_team_ids: reversedTeamIds,
        p_team_names: ["Race Alpha", "Race Bravo"],
      },
    },
  ]);
  assert.ok(successCount(startResults) === 1 || successCount(startResults) === 2);
  const startState = await assertDraftInvariants(startFixture.draft.id);
  assert.equal(startState.draft.status, "active");
  console.log("PASS start and setup race leaves coherent active state");

  console.log("Concurrency contract tests passed.");
}

try {
  await runContracts();
} finally {
  if (databaseConnected && createdDraftIds.length > 0) {
    await database.query("delete from public.drafts where id = any($1::uuid[])", [
      createdDraftIds,
    ]);
  }
  await Promise.allSettled(
    createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId))
  );
  if (databaseConnected) {
    await database.end();
  }
}
