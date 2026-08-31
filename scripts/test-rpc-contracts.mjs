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
let draftId = null;
let leagueId = null;
let leagueDraftId = null;
let databaseConnected = false;

function createPublicClient() {
  return createClient(environment.API_URL, environment.ANON_KEY, clientOptions);
}

async function createUserAndSignIn(client, label) {
  const suffix = `${Date.now()}-${crypto.randomUUID()}`;
  const email = `rpc-${label}-${suffix}@example.com`;
  const password = `Rpc-${suffix}-Aa1!`;
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

  if (signInError || !signedIn.user || !signedIn.session) {
    throw signInError ?? new Error(`Unable to sign in ${label}.`);
  }

  return signedIn.user;
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

async function readDraftState() {
  const draft = await database.query(
    `select id, current_pick, status, pick_seconds, pick_deadline_at,
      paused_remaining_seconds from public.drafts where id = $1`,
    [draftId]
  );
  const teams = await database.query(
    `select id, name, draft_position from public.teams
      where draft_id = $1 order by draft_position`,
    [draftId]
  );
  const participants = await database.query(
    `select id, user_id, team_id, role from public.draft_participants
      where draft_id = $1 order by id`,
    [draftId]
  );
  const picks = await database.query(
    `select id, team_id, player_id, overall_pick_number from public.picks
      where draft_id = $1 order by overall_pick_number`,
    [draftId]
  );

  assert.equal(draft.rows.length, 1, "Authoritative draft row is missing.");
  return {
    draft: draft.rows[0],
    teams: teams.rows,
    participants: participants.rows,
    picks: picks.rows,
  };
}

async function readLinkedLeagueOwnerState(targetDraftId) {
  const rows = await database.query(
    `select lts.league_team_id, lts.draft_team_id, lts.owner_user_id,
            dp.user_id as participant_user_id, dp.team_id as participant_team_id
       from public.league_team_seasons lts
       left join public.draft_participants dp
         on dp.draft_id = $1 and dp.team_id = lts.draft_team_id
      where lts.league_season_id = (
        select id from public.league_seasons where draft_id = $1
      )
      order by lts.draft_position`,
    [targetDraftId]
  );

  return rows.rows;
}

async function expectRejectedWithoutWrites(
  client,
  name,
  args,
  expectedCode,
  description
) {
  const before = await readDraftState();
  const { error } = await client.rpc(name, args);

  assert.ok(error, `${description} should fail.`);
  assert.equal(error.code, expectedCode, `${description}: ${error.message}`);
  assert.deepEqual(
    await readDraftState(),
    before,
    `${description} changed authoritative state.`
  );
  console.log(`PASS ${description}`);
}

async function runContracts() {
  await waitForLocalSupabaseAuth(environment);
  await database.connect();
  databaseConnected = true;

  const commissioner = createPublicClient();
  const owner = createPublicClient();
  const otherOwner = createPublicClient();
  const unassigned = createPublicClient();
  const unrelated = createPublicClient();

  const commissionerUser = await createUserAndSignIn(
    commissioner,
    "commissioner"
  );
  await createUserAndSignIn(owner, "owner");
  await createUserAndSignIn(otherOwner, "other-owner");
  await createUserAndSignIn(unassigned, "unassigned");
  await createUserAndSignIn(unrelated, "unrelated");

  const draft = await rpc(commissioner, "create_draft", {
    p_name: "RPC Contract Draft",
    p_team_count: 3,
    p_rounds: 2,
    p_display_name: "commissioner",
  });
  assert.ok(draft?.id && draft?.join_code, "create_draft returned no draft.");
  draftId = draft.id;
  console.log("PASS commissioner creates draft");

  const ownerParticipant = await rpc(owner, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: "owner",
  });
  const otherOwnerParticipant = await rpc(otherOwner, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: "other-owner",
  });
  const unassignedParticipant = await rpc(unassigned, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: "unassigned",
  });
  assert.equal(ownerParticipant.draft_id, draftId);
  assert.equal(otherOwnerParticipant.draft_id, draftId);
  assert.equal(unassignedParticipant.team_id, null);
  console.log("PASS owners join draft");

  const initialState = await readDraftState();
  const originalTeams = initialState.teams;
  const orderedTeamIds = [originalTeams[1].id, originalTeams[0].id, originalTeams[2].id];
  const updatedTeams = await rpc(commissioner, "update_team_setup", {
    p_draft_id: draftId,
    p_team_ids: orderedTeamIds,
    p_team_names: ["Alpha", "Bravo", "Charlie"],
  });
  assert.deepEqual(
    updatedTeams.map((team) => [team.id, team.name, team.draft_position]),
    [
      [orderedTeamIds[0], "Alpha", 1],
      [orderedTeamIds[1], "Bravo", 2],
      [orderedTeamIds[2], "Charlie", 3],
    ]
  );
  console.log("PASS commissioner updates team setup");

  await expectRejectedWithoutWrites(
    unrelated,
    "update_team_setup",
    {
      p_draft_id: draftId,
      p_team_ids: orderedTeamIds,
      p_team_names: ["Wrong", "Wrong", "Wrong"],
    },
    "42501",
    "unrelated user cannot update team setup"
  );

  const participantsResult = await database.query(
    `select id, user_id, team_id from public.draft_participants
      where draft_id = $1`,
    [draftId]
  );
  const participants = participantsResult.rows;
  const commissionerParticipant = participants.find(
    (participant) => participant.user_id === commissionerUser.id
  );
  assert.ok(commissionerParticipant, "Commissioner participant is missing.");

  await rpc(commissioner, "assign_team", {
    p_draft_id: draftId,
    p_participant_id: commissionerParticipant.id,
    p_team_id: orderedTeamIds[0],
  });
  await rpc(commissioner, "assign_team", {
    p_draft_id: draftId,
    p_participant_id: ownerParticipant.id,
    p_team_id: orderedTeamIds[1],
  });
  await rpc(commissioner, "assign_team", {
    p_draft_id: draftId,
    p_participant_id: otherOwnerParticipant.id,
    p_team_id: orderedTeamIds[2],
  });
  console.log("PASS commissioner assigns teams");

  const league = await rpc(commissioner, "create_league", {
    p_name: "Owner Sync League",
    p_slug: `owner-sync-${Date.now()}`,
  });
  leagueId = league.id;
  const seasonResult = await database.query(
    `select id from public.league_seasons
      where league_id = $1
      order by year desc
      limit 1`,
    [leagueId]
  );
  const leagueSeasonId = seasonResult.rows[0]?.id;
  assert.ok(leagueSeasonId, "create_league should create a season.");

  const { data: leagueTeams, error: leagueTeamsError } = await commissioner
    .from("league_teams")
    .insert([
      { league_id: leagueId, name: "League Alpha" },
      { league_id: leagueId, name: "League Bravo" },
    ])
    .select("id")
    .order("name");
  if (leagueTeamsError) throw leagueTeamsError;
  assert.equal(leagueTeams.length, 2, "Expected two league teams.");

  const { error: memberInsertError } = await commissioner
    .from("league_members")
    .insert([
      { league_id: leagueId, user_id: ownerParticipant.user_id, role: "member" },
      { league_id: leagueId, user_id: otherOwnerParticipant.user_id, role: "member" },
    ]);
  if (memberInsertError) throw memberInsertError;

  const linkedSeason = await rpc(commissioner, "create_draft_for_season", {
    p_season_id: leagueSeasonId,
    p_name: "Linked Owner Sync Draft",
    p_team_count: 2,
    p_rounds: 1,
    p_display_name: "commissioner",
  });
  leagueDraftId = linkedSeason.draft_id;
  assert.ok(leagueDraftId, "create_draft_for_season should link a draft.");

  await rpc(commissioner, "start_draft", { p_draft_id: leagueDraftId });
  await rpc(commissioner, "pause_draft", { p_draft_id: leagueDraftId });

  const linkedBefore = await readLinkedLeagueOwnerState(leagueDraftId);
  assert.equal(linkedBefore[0].participant_user_id, null);
  await rpc(commissioner, "assign_league_team_owner", {
    p_league_id: leagueId,
    p_league_team_id: leagueTeams[0].id,
    p_user_id: ownerParticipant.user_id,
  });

  const linkedAfter = await readLinkedLeagueOwnerState(leagueDraftId);
  assert.equal(linkedAfter[0].owner_user_id, ownerParticipant.user_id);
  assert.equal(linkedAfter[0].participant_user_id, ownerParticipant.user_id);
  assert.equal(linkedAfter[0].participant_team_id, linkedAfter[0].draft_team_id);
  console.log("PASS league owner assignment syncs into paused linked draft");

  await rpc(commissioner, "assign_draft_team_owner_from_league_member", {
    p_draft_id: leagueDraftId,
    p_draft_team_id: linkedAfter[1].draft_team_id,
    p_user_id: otherOwnerParticipant.user_id,
  });

  const linkedDraftAssigned = await readLinkedLeagueOwnerState(leagueDraftId);
  assert.equal(linkedDraftAssigned[1].owner_user_id, otherOwnerParticipant.user_id);
  assert.equal(linkedDraftAssigned[1].participant_user_id, otherOwnerParticipant.user_id);
  assert.equal(linkedDraftAssigned[1].participant_team_id, linkedDraftAssigned[1].draft_team_id);
  console.log("PASS draft settings can assign a league member by user id");

  await rpc(commissioner, "resume_draft", { p_draft_id: leagueDraftId });
  const linkedActiveBefore = await readLinkedLeagueOwnerState(leagueDraftId);
  const { error: activeAssignError } = await commissioner.rpc("assign_league_team_owner", {
    p_league_id: leagueId,
    p_league_team_id: leagueTeams[0].id,
    p_user_id: otherOwnerParticipant.user_id,
  });
  assert.ok(activeAssignError, "league owner assignment should fail for active linked drafts.");
  assert.equal(activeAssignError.code, "P0001");
  assert.deepEqual(
    await readLinkedLeagueOwnerState(leagueDraftId),
    linkedActiveBefore,
    "active linked draft assignment changed authoritative state."
  );
  console.log("PASS active linked draft blocks league owner reassignment");

  await expectRejectedWithoutWrites(
    owner,
    "assign_team",
    {
      p_draft_id: draftId,
      p_participant_id: unassignedParticipant.id,
      p_team_id: orderedTeamIds[0],
    },
    "42501",
    "owner cannot assign teams"
  );
  await expectRejectedWithoutWrites(
    unrelated,
    "start_draft",
    { p_draft_id: draftId },
    "42501",
    "unrelated user cannot start draft"
  );

  const playersResult = await database.query(
    `select id, external_id from public.players
      where source = 'test' and active
      order by external_id limit 6`
  );
  const players = playersResult.rows;
  assert.equal(players.length, 6, "Six seeded players are required.");

  await expectRejectedWithoutWrites(
    commissioner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id, p_expected_pick: 1 },
    "P0001",
    "pick cannot be made before draft starts"
  );
  const startedDraft = await rpc(commissioner, "start_draft", {
    p_draft_id: draftId,
  });
  assert.equal(startedDraft.status, "active");
  assert.ok(startedDraft.pick_deadline_at);
  console.log("PASS commissioner starts draft");

  await expectRejectedWithoutWrites(
    owner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id, p_expected_pick: 1 },
    "42501",
    "wrong owner cannot make opening pick"
  );
  await expectRejectedWithoutWrites(
    unassigned,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id, p_expected_pick: 1 },
    "42501",
    "unassigned owner cannot pick"
  );
  await expectRejectedWithoutWrites(
    unrelated,
    "commissioner_make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id, p_expected_pick: 1 },
    "42501",
    "unrelated user cannot make recovery pick"
  );

  await rpc(commissioner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[0].id,
    p_expected_pick: 1,
  });
  assert.equal((await readDraftState()).draft.current_pick, 2);
  console.log("PASS assigned commissioner makes opening pick");

  await expectRejectedWithoutWrites(
    otherOwner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[1].id, p_expected_pick: 2 },
    "42501",
    "out-of-turn owner cannot pick"
  );
  await expectRejectedWithoutWrites(
    owner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id, p_expected_pick: 2 },
    "23505",
    "duplicate player cannot be drafted"
  );
  await rpc(owner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[1].id,
    p_expected_pick: 2,
  });
  console.log("PASS assigned owner makes allowed pick");

  await rpc(commissioner, "commissioner_make_pick", {
    p_draft_id: draftId,
    p_player_id: players[2].id,
    p_expected_pick: 3,
  });
  console.log("PASS commissioner makes recovery pick");

  await expectRejectedWithoutWrites(
    owner,
    "pause_draft",
    { p_draft_id: draftId },
    "42501",
    "owner cannot pause draft"
  );
  const pausedDraft = await rpc(commissioner, "pause_draft", {
    p_draft_id: draftId,
  });
  assert.equal(pausedDraft.status, "paused");
  assert.equal(pausedDraft.pick_deadline_at, null);
  console.log("PASS commissioner pauses draft");

  await expectRejectedWithoutWrites(
    otherOwner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[3].id, p_expected_pick: 4 },
    "P0001",
    "pick cannot be made while paused"
  );
  await expectRejectedWithoutWrites(
    unrelated,
    "resume_draft",
    { p_draft_id: draftId },
    "42501",
    "unrelated user cannot resume draft"
  );
  const resumedDraft = await rpc(commissioner, "resume_draft", {
    p_draft_id: draftId,
  });
  assert.equal(resumedDraft.status, "active");
  assert.ok(resumedDraft.pick_deadline_at);
  console.log("PASS commissioner resumes draft");

  await rpc(otherOwner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[3].id,
    p_expected_pick: 4,
  });
  await rpc(owner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[4].id,
    p_expected_pick: 5,
  });
  await rpc(commissioner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[5].id,
    p_expected_pick: 6,
  });
  const completedState = await readDraftState();
  assert.equal(completedState.draft.status, "complete");
  assert.equal(completedState.draft.current_pick, 7);
  assert.equal(completedState.picks.length, 6);
  console.log("PASS valid owners complete snake draft");

  await expectRejectedWithoutWrites(
    owner,
    "undo_pick",
    { p_draft_id: draftId },
    "42501",
    "owner cannot undo pick"
  );
  await rpc(commissioner, "undo_pick", { p_draft_id: draftId });
  const rewoundState = await readDraftState();
  assert.equal(rewoundState.draft.status, "active");
  assert.equal(rewoundState.draft.current_pick, 6);
  assert.equal(rewoundState.picks.length, 5);
  assert.equal(
    rewoundState.picks.some((pick) => pick.player_id === players[5].id),
    false
  );
  console.log("PASS commissioner undo rewinds latest pick");

  console.log("RPC contract tests passed.");
}

try {
  await runContracts();
} finally {
  if (draftId && databaseConnected) {
    await database.query("delete from public.drafts where id = $1", [draftId]);
  }
  if (leagueDraftId && databaseConnected) {
    await database.query("delete from public.drafts where id = $1", [leagueDraftId]);
  }
  if (leagueId && databaseConnected) {
    await database.query("delete from public.leagues where id = $1", [leagueId]);
  }

  await Promise.allSettled(
    createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId))
  );

  if (databaseConnected) {
    await database.end();
  }
}
