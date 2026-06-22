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
  const email = `rls-${label}-${suffix}@example.com`;
  const password = `Rls-${suffix}-Aa1!`;
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

  return signedIn.user;
}

async function createAnonymousUser(client) {
  const { data, error } = await client.auth.signInAnonymously({
    options: { data: { display_name: "anonymous-owner" } },
  });

  if (error || !data.user) {
    throw error ?? new Error("Unable to create anonymous owner.");
  }

  createdUserIds.push(data.user.id);
  return data.user;
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

async function expectRows(queryBuilder, expectedCount, description) {
  const { data, error } = await queryBuilder;
  assert.equal(error, null, `${description}: ${error?.message}`);
  assert.equal(data?.length, expectedCount, description);
}

async function expectPermissionDenied(queryBuilder, description) {
  const { error } = await queryBuilder;
  assert.ok(error, `${description} should fail.`);
  assert.equal(error.code, "42501", `${description}: ${error.message}`);
}

async function assertRoomVisibility(client, expectedCount, description) {
  await expectRows(
    client.from("drafts").select("id").eq("id", draftId),
    expectedCount,
    `${description} drafts visibility`
  );
  await expectRows(
    client.from("teams").select("id").eq("draft_id", draftId),
    expectedCount === 0 ? 0 : 2,
    `${description} teams visibility`
  );
  await expectRows(
    client
      .from("draft_participants")
      .select("id")
      .eq("draft_id", draftId),
    expectedCount === 0 ? 0 : 4,
    `${description} participants visibility`
  );
  await expectRows(
    client.from("picks").select("id").eq("draft_id", draftId),
    expectedCount,
    `${description} picks visibility`
  );
}

async function runContracts() {
  await waitForLocalSupabaseAuth(environment);
  await database.connect();
  databaseConnected = true;

  const commissioner = createPublicClient();
  const owner = createPublicClient();
  const unassigned = createPublicClient();
  const anonymousOwner = createPublicClient();
  const unrelated = createPublicClient();
  const unauthenticated = createPublicClient();

  const commissionerUser = await createUserAndSignIn(
    commissioner,
    "commissioner"
  );
  await createUserAndSignIn(owner, "assigned-owner");
  await createUserAndSignIn(unassigned, "unassigned-owner");
  await createAnonymousUser(anonymousOwner);
  const unrelatedUser = await createUserAndSignIn(unrelated, "unrelated");

  const league = await rpc(commissioner, "create_league", {
    p_name: "RLS Contract League",
    p_slug: `rls-contract-${crypto.randomUUID()}`,
  });
  leagueId = league.id;

  const { error: addMemberError } = await commissioner
    .from("league_members")
    .insert({ league_id: leagueId, user_id: unrelatedUser.id, role: "member" });
  assert.equal(addMemberError, null, addMemberError?.message);

  await expectRows(
    commissioner.from("leagues").select("id").eq("id", leagueId),
    1,
    "league commissioner visibility"
  );
  await expectRows(
    unrelated.from("leagues").select("id").eq("id", leagueId),
    1,
    "league member visibility"
  );
  await expectRows(
    owner.from("leagues").select("id").eq("id", leagueId),
    0,
    "non-member league visibility"
  );

  const { data: memberUpdate, error: memberUpdateError } = await unrelated
    .from("leagues")
    .update({ name: "Forbidden member update" })
    .eq("id", leagueId)
    .select("id");
  assert.equal(memberUpdateError, null, memberUpdateError?.message);
  assert.deepEqual(memberUpdate, []);

  const { data: commissionerUpdate, error: commissionerUpdateError } =
    await commissioner
      .from("leagues")
      .update({ name: "Updated Contract League" })
      .eq("id", leagueId)
      .select("name")
      .single();
  assert.equal(commissionerUpdateError, null, commissionerUpdateError?.message);
  assert.equal(commissionerUpdate?.name, "Updated Contract League");

  const { error: anonymousLeagueError } = await anonymousOwner.rpc(
    "create_league",
    { p_name: "Anonymous League", p_slug: "anonymous-league" }
  );
  assert.equal(anonymousLeagueError?.code, "42501");

  const leagueDraft = await rpc(commissioner, "create_league_draft", {
    p_name: "League Contract Draft",
    p_team_count: 2,
    p_rounds: 1,
    p_display_name: "commissioner",
    p_league_id: leagueId,
  });
  leagueDraftId = leagueDraft.id;
  assert.equal(leagueDraft.league_id, leagueId);

  const { error: memberDraftError } = await unrelated.rpc(
    "create_league_draft",
    {
      p_name: "Forbidden League Draft",
      p_team_count: 2,
      p_rounds: 1,
      p_display_name: "unrelated",
      p_league_id: leagueId,
    }
  );
  assert.equal(memberDraftError?.code, "42501");
  console.log("PASS league RLS and linked-draft authorization");

  const draft = await rpc(commissioner, "create_draft", {
    p_name: "RLS Contract Draft",
    p_team_count: 2,
    p_rounds: 1,
    p_display_name: "commissioner",
  });
  draftId = draft.id;
  assert.equal(draft.league_id, null);
  console.log("PASS standalone drafts remain unlinked");

  const ownerParticipant = await rpc(owner, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: "assigned-owner",
  });
  await rpc(unassigned, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: "unassigned-owner",
  });
  await rpc(anonymousOwner, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: "anonymous-owner",
  });

  const participants = await database.query(
    `select id, user_id from public.draft_participants where draft_id = $1`,
    [draftId]
  );
  const commissionerParticipant = participants.rows.find(
    (participant) => participant.user_id === commissionerUser.id
  );
  assert.ok(commissionerParticipant, "Commissioner participant is missing.");

  const teams = await database.query(
    `select id from public.teams where draft_id = $1 order by draft_position`,
    [draftId]
  );
  await rpc(commissioner, "assign_team", {
    p_draft_id: draftId,
    p_participant_id: commissionerParticipant.id,
    p_team_id: teams.rows[0].id,
  });
  await rpc(commissioner, "assign_team", {
    p_draft_id: draftId,
    p_participant_id: ownerParticipant.id,
    p_team_id: teams.rows[1].id,
  });
  await rpc(commissioner, "start_draft", { p_draft_id: draftId });

  const player = await database.query(
    `select id from public.players where source = 'test'
      order by external_id limit 1`
  );
  await rpc(commissioner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: player.rows[0].id,
    p_expected_pick: 1,
  });

  const invitationEmail = `rls-invite-${crypto.randomUUID()}@example.com`;
  const { data: invitation, error: invitationError } = await admin
    .from("draft_invitations")
    .upsert(
      {
        draft_id: draftId,
        email: invitationEmail,
        team_id: null,
        invited_by_user_id: commissionerUser.id,
        status: "pending",
      },
      { onConflict: "draft_id,email" }
    )
    .select("id")
    .single();
  assert.equal(invitationError, null, invitationError?.message);
  assert.ok(invitation?.id, "Service role did not create invitation.");
  console.log("PASS service role has current server-route privileges");

  await assertRoomVisibility(commissioner, 1, "commissioner");
  await assertRoomVisibility(owner, 1, "assigned owner");
  await assertRoomVisibility(unassigned, 1, "unassigned participant");
  await assertRoomVisibility(anonymousOwner, 1, "anonymous participant");
  await assertRoomVisibility(unrelated, 0, "unrelated user");
  console.log("PASS room reads are participant-scoped");

  await expectRows(
    commissioner
      .from("draft_invitations")
      .select("id")
      .eq("draft_id", draftId),
    1,
    "commissioner invitation visibility"
  );
  for (const [client, description] of [
    [owner, "assigned owner"],
    [unassigned, "unassigned participant"],
    [anonymousOwner, "anonymous participant"],
    [unrelated, "unrelated user"],
  ]) {
    await expectRows(
      client
        .from("draft_invitations")
        .select("id")
        .eq("draft_id", draftId),
      0,
      `${description} invitation visibility`
    );
  }
  console.log("PASS invitations are commissioner-only");

  for (const [client, description] of [
    [commissioner, "commissioner"],
    [owner, "assigned owner"],
    [unassigned, "unassigned participant"],
    [anonymousOwner, "anonymous participant"],
    [unrelated, "unrelated user"],
  ]) {
    const { data, error } = await client.from("players").select("id").limit(1);
    assert.equal(error, null, `${description} player read: ${error?.message}`);
    assert.equal(data?.length, 1, `${description} cannot read players.`);
  }
  await expectPermissionDenied(
    unauthenticated.from("players").select("id").limit(1),
    "unauthenticated player read"
  );
  console.log("PASS player catalog requires authenticated role");

  const ownBio = "RLS own-profile update";
  const { data: updatedProfile, error: ownProfileError } = await unrelated
    .from("profiles")
    .update({ bio: ownBio })
    .eq("id", unrelatedUser.id)
    .select("id,bio")
    .single();
  assert.equal(ownProfileError, null, ownProfileError?.message);
  assert.equal(updatedProfile?.bio, ownBio);

  const { data: crossProfile, error: crossProfileError } = await unrelated
    .from("profiles")
    .update({ bio: "forbidden" })
    .eq("id", commissionerUser.id)
    .select("id");
  assert.equal(crossProfileError, null, crossProfileError?.message);
  assert.deepEqual(crossProfile, []);
  const commissionerProfile = await database.query(
    "select bio from public.profiles where id = $1",
    [commissionerUser.id]
  );
  assert.equal(commissionerProfile.rows[0].bio, null);
  console.log("PASS profiles allow only self updates");

  await expectPermissionDenied(
    owner.from("drafts").update({ name: "Direct write" }).eq("id", draftId),
    "direct draft update"
  );
  await expectPermissionDenied(
    owner
      .from("teams")
      .update({ name: "Direct write" })
      .eq("id", teams.rows[1].id),
    "direct team update"
  );
  await expectPermissionDenied(
    owner
      .from("draft_participants")
      .update({ display_name: "Direct write" })
      .eq("id", ownerParticipant.id),
    "direct participant update"
  );
  await expectPermissionDenied(
    owner
      .from("players")
      .update({ full_name: "Direct write" })
      .eq("id", player.rows[0].id),
    "direct player update"
  );
  await expectPermissionDenied(
    owner.from("picks").insert({
      draft_id: draftId,
      team_id: teams.rows[1].id,
      player_id: player.rows[0].id,
      round: 1,
      pick_number: 2,
      overall_pick_number: 2,
    }),
    "direct pick insert"
  );
  await expectPermissionDenied(
    owner.from("draft_invitations").insert({
      draft_id: draftId,
      email: `forbidden-${crypto.randomUUID()}@example.com`,
      invited_by_user_id: unrelatedUser.id,
      status: "pending",
    }),
    "direct invitation insert"
  );
  console.log("PASS browser draft writes remain RPC-only");

  await expectPermissionDenied(
    admin.from("drafts").update({ name: "Elevated write" }).eq("id", draftId),
    "service role draft update outside current route privileges"
  );
  await expectRows(
    admin.from("drafts").select("id").eq("id", draftId),
    1,
    "service role draft read"
  );
  await expectRows(
    admin
      .from("draft_invitations")
      .select("id")
      .eq("draft_id", draftId),
    1,
    "service role invitation read"
  );
  console.log("PASS clean local service role grants match the route contract");
  console.log("RLS contract tests passed.");
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
