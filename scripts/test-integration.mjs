import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  getLocalSupabaseEnvironment,
  waitForLocalSupabaseAuth,
} from "./local-supabase-env.mjs";

const env = getLocalSupabaseEnvironment();
await waitForLocalSupabaseAuth(env);

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, clientOptions);

function publicClient() {
  return createClient(env.API_URL, env.ANON_KEY, clientOptions);
}

const createdUserIds = [];
const createdDraftIds = [];

async function createIdentity(label) {
  const client = publicClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `int-${label}-${suffix}@example.com`;
  const password = `Int-${suffix}-Aa1!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: label },
  });
  if (createError || !created.user) {
    throw createError ?? new Error(`Cannot create user ${label}`);
  }
  createdUserIds.push(created.user.id);
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signedIn.session) {
    throw signInError ?? new Error(`Cannot sign in ${label}`);
  }
  await client.realtime.setAuth(signedIn.session.access_token);
  return { client, user: signedIn.user };
}

async function call(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return Array.isArray(data) && data.length === 1 ? data[0] : data;
}

async function callExpectError(client, name, args, expectedCode) {
  const { error } = await client.rpc(name, args);
  assert.ok(error, `${name} should have returned an error but succeeded`);
  assert.equal(
    error.code,
    expectedCode,
    `${name}: expected error code ${expectedCode}, got ${error.code}: ${error.message}`
  );
}

async function fetchDraft(client, draftId) {
  const { data, error } = await client
    .from("drafts")
    .select("*")
    .eq("id", draftId)
    .single();
  if (error) throw error;
  return data;
}

async function getPlayers(client, count) {
  const { data, error } = await client
    .from("players")
    .select("id")
    .eq("active", true)
    .order("full_name")
    .limit(count);
  if (error) throw error;
  if (data.length < count) {
    throw new Error(`Need ${count} active players, found ${data.length}`);
  }
  return data;
}

async function setupDraft(commLabel, ownerLabel, { rounds = 2, timerSeconds = null } = {}) {
  const commissioner = await createIdentity(commLabel);
  const owner = await createIdentity(ownerLabel);

  const draft = await call(commissioner.client, "create_draft", {
    p_name: `Integration ${commLabel} ${Date.now()}`,
    p_team_count: 2,
    p_rounds: rounds,
    p_display_name: commLabel,
  });
  createdDraftIds.push(draft.id);

  const ownerParticipant = await call(owner.client, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: ownerLabel,
  });

  const { data: teams } = await admin
    .from("teams")
    .select("id,draft_position")
    .eq("draft_id", draft.id)
    .order("draft_position");

  const { data: participants } = await admin
    .from("draft_participants")
    .select("id,user_id")
    .eq("draft_id", draft.id);

  const commParticipant = participants.find((p) => p.user_id === commissioner.user.id);

  await call(commissioner.client, "assign_team", {
    p_draft_id: draft.id,
    p_participant_id: commParticipant.id,
    p_team_id: teams[0].id,
  });
  await call(commissioner.client, "assign_team", {
    p_draft_id: draft.id,
    p_participant_id: ownerParticipant.id,
    p_team_id: teams[1].id,
  });

  if (timerSeconds !== null) {
    await call(commissioner.client, "configure_draft_timer", {
      p_draft_id: draft.id,
      p_pick_seconds: timerSeconds,
    });
  }

  return { commissioner, owner, draft, teams };
}

function subscribe(client, draftId, label) {
  const events = { draftUpdates: 0, pickInserts: 0, pickDeletes: 0 };
  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
    setTimeout(
      () => rejectReady(new Error(`${label} Realtime subscription timed out`)),
      15000
    );
  });
  const channel = client
    .channel(`integration:${draftId}:${label}:${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "drafts", filter: `id=eq.${draftId}` },
      () => { events.draftUpdates++; }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "picks", filter: `draft_id=eq.${draftId}` },
      () => { events.pickInserts++; }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "picks" },
      () => { events.pickDeletes++; }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") resolveReady();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        rejectReady(new Error(`${label} channel status: ${status}`));
      }
    });
  return { channel, events, ready };
}

async function waitFor(predicate, description, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for: ${description}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

// ---- test runner ----

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    failed++;
  }
}

// ---- test 1: Realtime delivers pick inserts and draft updates to all subscribers ----

await test("realtime delivers pick inserts and draft updates to all subscribers", async () => {
  const { commissioner, owner, draft, teams } = await setupDraft("rt-comm", "rt-owner");
  const players = await getPlayers(commissioner.client, 4);

  const commSub = subscribe(commissioner.client, draft.id, "commissioner");
  const ownerSub = subscribe(owner.client, draft.id, "owner");
  await Promise.all([commSub.ready, ownerSub.ready]);

  await call(commissioner.client, "start_draft", { p_draft_id: draft.id });

  // 2-team snake: commissioner picks 1 and 4, owner picks 2 and 3
  await call(commissioner.client, "make_pick", {
    p_draft_id: draft.id,
    p_player_id: players[0].id,
    p_expected_pick: 1,
  });
  await call(owner.client, "make_pick", {
    p_draft_id: draft.id,
    p_player_id: players[1].id,
    p_expected_pick: 2,
  });
  await call(owner.client, "make_pick", {
    p_draft_id: draft.id,
    p_player_id: players[2].id,
    p_expected_pick: 3,
  });
  await call(commissioner.client, "make_pick", {
    p_draft_id: draft.id,
    p_player_id: players[3].id,
    p_expected_pick: 4,
  });

  await waitFor(
    () => commSub.events.pickInserts >= 4 && commSub.events.draftUpdates >= 4,
    "commissioner Realtime: 4 pick inserts and 4 draft updates"
  );
  await waitFor(
    () => ownerSub.events.pickInserts >= 4 && ownerSub.events.draftUpdates >= 4,
    "owner Realtime: 4 pick inserts and 4 draft updates"
  );

  const completedDraft = await fetchDraft(commissioner.client, draft.id);
  assert.equal(completedDraft.status, "complete");
  assert.equal(completedDraft.current_pick, 5);

  const { data: picks, error: picksError } = await commissioner.client
    .from("picks")
    .select("team_id,overall_pick_number")
    .eq("draft_id", draft.id)
    .order("overall_pick_number");
  if (picksError) throw picksError;
  assert.equal(picks.length, 4);
  assert.deepEqual(
    picks.map((p) => p.team_id),
    [teams[0].id, teams[1].id, teams[1].id, teams[0].id],
    "Snake order: commissioner, owner, owner, commissioner"
  );

  await Promise.allSettled([
    commissioner.client.removeChannel(commSub.channel),
    owner.client.removeChannel(ownerSub.channel),
  ]);
});

// ---- test 2: Reconnected client receives subsequent pick events after re-subscribing ----

await test("reconnected client receives events after channel re-subscription", async () => {
  const { commissioner, owner, draft } = await setupDraft("rc-comm", "rc-owner");
  const players = await getPlayers(commissioner.client, 4);

  const initialSub = subscribe(commissioner.client, draft.id, "initial");
  await initialSub.ready;

  await call(commissioner.client, "start_draft", { p_draft_id: draft.id });
  await call(commissioner.client, "make_pick", {
    p_draft_id: draft.id,
    p_player_id: players[0].id,
    p_expected_pick: 1,
  });

  await waitFor(
    () => initialSub.events.pickInserts >= 1,
    "initial subscription: pick 1 insert received"
  );

  // Simulate disconnect by removing the channel
  await commissioner.client.removeChannel(initialSub.channel);

  // Re-subscribe (new channel)
  const reconnectedSub = subscribe(commissioner.client, draft.id, "reconnected");
  await reconnectedSub.ready;

  // Full state re-fetch after reconnect reflects correct position
  const midDraft = await fetchDraft(commissioner.client, draft.id);
  assert.equal(midDraft.current_pick, 2, "current_pick should be 2 after pick 1");
  assert.equal(midDraft.status, "active");

  // Owner is on the clock for pick 2 — their pick should arrive on the reconnected channel
  await call(owner.client, "make_pick", {
    p_draft_id: draft.id,
    p_player_id: players[1].id,
    p_expected_pick: 2,
  });

  await waitFor(
    () => reconnectedSub.events.pickInserts >= 1,
    "reconnected subscription: pick 2 insert received"
  );

  await Promise.allSettled([
    commissioner.client.removeChannel(reconnectedSub.channel),
  ]);
});

// ---- test 3: Timer state is set on start, cleared on pause, and reset on resume ----

await test("timer state is set on start, cleared on pause, and reset on resume", async () => {
  const { commissioner, draft } = await setupDraft("tmr-comm", "tmr-owner", {
    timerSeconds: 30,
  });

  await call(commissioner.client, "start_draft", { p_draft_id: draft.id });

  const started = await fetchDraft(commissioner.client, draft.id);
  assert.equal(started.status, "active");
  assert.equal(started.pick_seconds, 30);
  assert.ok(started.pick_deadline_at, "pick_deadline_at must be set after start");
  assert.ok(
    new Date(started.pick_deadline_at) > new Date(),
    "pick_deadline_at must be in the future"
  );

  await call(commissioner.client, "pause_draft", { p_draft_id: draft.id });

  const paused = await fetchDraft(commissioner.client, draft.id);
  assert.equal(paused.status, "paused");
  assert.equal(paused.pick_deadline_at, null, "pick_deadline_at must be null when paused");
  assert.ok(
    paused.paused_remaining_seconds !== null,
    "paused_remaining_seconds must be set on pause"
  );
  assert.ok(
    paused.paused_remaining_seconds <= 30,
    "paused_remaining_seconds must not exceed configured pick_seconds"
  );

  await call(commissioner.client, "resume_draft", { p_draft_id: draft.id });

  const resumed = await fetchDraft(commissioner.client, draft.id);
  assert.equal(resumed.status, "active");
  assert.ok(resumed.pick_deadline_at, "pick_deadline_at must be set after resume");
  assert.ok(
    new Date(resumed.pick_deadline_at) > new Date(),
    "pick_deadline_at must be in the future after resume"
  );
  assert.equal(
    resumed.paused_remaining_seconds,
    null,
    "paused_remaining_seconds must be cleared on resume"
  );
});

// ---- test 4: Stale expected_pick is rejected without corrupting draft state ----

await test("stale expected_pick is rejected with P0001 and draft state is unchanged", async () => {
  const { commissioner, draft } = await setupDraft("stale-comm", "stale-owner");
  const players = await getPlayers(commissioner.client, 2);

  await call(commissioner.client, "start_draft", { p_draft_id: draft.id });

  // Pick 1 succeeds; current_pick advances to 2
  await call(commissioner.client, "make_pick", {
    p_draft_id: draft.id,
    p_player_id: players[0].id,
    p_expected_pick: 1,
  });

  // Attempt a pick with the old expected_pick — must be rejected
  await callExpectError(
    commissioner.client,
    "commissioner_make_pick",
    { p_draft_id: draft.id, p_player_id: players[1].id, p_expected_pick: 1 },
    "P0001"
  );

  const mid = await fetchDraft(commissioner.client, draft.id);
  assert.equal(mid.current_pick, 2, "current_pick must remain 2 after stale rejection");

  const { data: picks, error: picksError } = await commissioner.client
    .from("picks")
    .select("id")
    .eq("draft_id", draft.id);
  if (picksError) throw picksError;
  assert.equal(picks.length, 1, "Exactly 1 pick must exist after stale rejection");
});

// ---- summary ----

const total = passed + failed;
if (failed > 0) {
  console.error(`\n${total} integration tests: ${passed} passed, ${failed} failed`);
  process.exitCode = 1;
} else {
  console.log(`\n${total} integration tests passed`);
}

// ---- cleanup ----

await Promise.allSettled(
  createdDraftIds.map((id) => admin.from("drafts").delete().eq("id", id))
);
await Promise.allSettled(
  createdUserIds.map((id) => admin.auth.admin.deleteUser(id))
);
