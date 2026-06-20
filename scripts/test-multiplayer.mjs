import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createUserAndSignIn(client, displayName) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `multiplayer-${suffix}@example.com`;
  const password = `Test-${suffix}-Aa!`;
  const { data: createData, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

  if (createError || !createData.user) {
    throw createError ?? new Error("User creation did not return a user.");
  }

  createdUserIds.push(createData.user.id);

  const { data: signInData, error: signInError } =
    await client.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    throw signInError ?? new Error("Sign-in did not return a user.");
  }

  return signInData.user;
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

async function expectRpcError(client, name, args, expectedCode) {
  const { error } = await client.rpc(name, args);

  assert.ok(error, `${name} should have failed.`);
  assert.equal(error.code, expectedCode, error.message);
}

async function selectRows(query, description) {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  assert.ok(data, `${description} returned no data.`);
  return data;
}

function subscribeToRoom(client, draftId, label) {
  const events = {
    draftUpdates: 0,
    pickDeletes: 0,
    pickInserts: 0,
  };
  let timeoutId;
  let resolveSubscribed;
  let rejectSubscribed;
  const subscribed = new Promise((resolve, reject) => {
    resolveSubscribed = resolve;
    rejectSubscribed = reject;
    timeoutId = setTimeout(
      () => reject(new Error(`${label} Realtime subscription timed out.`)),
      15000
    );
  });
  const channel = client
    .channel(`integration:${label}:${draftId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "drafts",
        filter: `id=eq.${draftId}`,
      },
      () => {
        events.draftUpdates += 1;
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "picks",
        filter: `draft_id=eq.${draftId}`,
      },
      () => {
        events.pickInserts += 1;
      }
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "picks",
      },
      () => {
        events.pickDeletes += 1;
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeoutId);
        resolveSubscribed();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeoutId);
        rejectSubscribed(new Error(`${label} Realtime status: ${status}`));
      }
    });

  return { channel, events, subscribed };
}

async function waitFor(predicate, description, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${description}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const commissioner = createPublicClient();
const owner = createPublicClient();
const createdUserIds = [];
const subscriptions = [];
let draftId = null;

try {
  const commissionerUser = await createUserAndSignIn(
    commissioner,
    "Commissioner Test"
  );
  await createUserAndSignIn(owner, "Owner Test");

  const draft = await rpc(commissioner, "create_draft", {
    p_name: `Integration Draft ${Date.now()}`,
    p_team_count: 2,
    p_rounds: 2,
    p_display_name: "Commissioner Test",
  });
  assert.ok(draft?.id, "create_draft did not return an ID.");
  draftId = draft.id;

  const ownerParticipant = await rpc(owner, "join_draft", {
    p_join_code: draft.join_code,
    p_display_name: "Owner Test",
  });
  assert.equal(ownerParticipant.draft_id, draftId);

  const teams = await selectRows(
    commissioner
      .from("teams")
      .select("id,draft_position")
      .eq("draft_id", draftId)
      .order("draft_position"),
    "teams"
  );
  const participants = await selectRows(
    commissioner
      .from("draft_participants")
      .select("id,user_id")
      .eq("draft_id", draftId),
    "participants"
  );
  const commissionerParticipant = participants.find(
    (participant) => participant.user_id === commissionerUser.id
  );
  assert.ok(commissionerParticipant, "Commissioner participant is missing.");

  await rpc(commissioner, "assign_team", {
    p_draft_id: draftId,
    p_participant_id: commissionerParticipant.id,
    p_team_id: teams[0].id,
  });
  await rpc(commissioner, "assign_team", {
    p_draft_id: draftId,
    p_participant_id: ownerParticipant.id,
    p_team_id: teams[1].id,
  });
  await rpc(commissioner, "configure_draft_timer", {
    p_draft_id: draftId,
    p_pick_seconds: 30,
  });

  const players = await selectRows(
    commissioner
      .from("players")
      .select("id")
      .eq("active", true)
      .order("full_name")
      .limit(4),
    "players"
  );
  assert.equal(players.length, 4, "Four active players are required.");

  const commissionerRealtime = subscribeToRoom(
    commissioner,
    draftId,
    "commissioner"
  );
  const ownerRealtime = subscribeToRoom(owner, draftId, "owner");
  subscriptions.push(
    [commissioner, commissionerRealtime.channel],
    [owner, ownerRealtime.channel]
  );
  await Promise.all([
    commissionerRealtime.subscribed,
    ownerRealtime.subscribed,
  ]);

  await expectRpcError(
    owner,
    "start_draft",
    { p_draft_id: draftId },
    "42501"
  );
  await expectRpcError(
    commissioner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id },
    "P0001"
  );
  await rpc(commissioner, "start_draft", { p_draft_id: draftId });

  const startedDraft = await selectRows(
    commissioner
      .from("drafts")
      .select("status,pick_seconds,pick_deadline_at")
      .eq("id", draftId)
      .single(),
    "started draft"
  );
  assert.equal(startedDraft.status, "active");
  assert.equal(startedDraft.pick_seconds, 30);
  assert.ok(startedDraft.pick_deadline_at, "Started draft has no deadline.");

  await expectRpcError(
    owner,
    "pause_draft",
    { p_draft_id: draftId },
    "42501"
  );
  await rpc(commissioner, "pause_draft", { p_draft_id: draftId });
  await expectRpcError(
    commissioner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id },
    "P0001"
  );

  const pausedDraft = await selectRows(
    commissioner
      .from("drafts")
      .select("status,pick_deadline_at,paused_remaining_seconds")
      .eq("id", draftId)
      .single(),
    "paused draft"
  );
  assert.equal(pausedDraft.status, "paused");
  assert.equal(pausedDraft.pick_deadline_at, null);
  assert.ok(pausedDraft.paused_remaining_seconds <= 30);

  await rpc(commissioner, "resume_draft", { p_draft_id: draftId });

  await expectRpcError(
    owner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id },
    "42501"
  );

  await rpc(commissioner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[0].id,
  });

  await expectRpcError(
    commissioner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[1].id },
    "42501"
  );
  await expectRpcError(
    owner,
    "make_pick",
    { p_draft_id: draftId, p_player_id: players[0].id },
    "23505"
  );

  await rpc(owner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[1].id,
  });
  await rpc(owner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[2].id,
  });
  await rpc(commissioner, "make_pick", {
    p_draft_id: draftId,
    p_player_id: players[3].id,
  });

  try {
    await waitFor(
      () =>
        commissionerRealtime.events.pickInserts >= 4 &&
        ownerRealtime.events.pickInserts >= 4 &&
        commissionerRealtime.events.draftUpdates >= 4 &&
        ownerRealtime.events.draftUpdates >= 4,
      "both clients to receive pick and draft updates"
    );
  } catch (realtimeError) {
    console.error(
      JSON.stringify(
        {
          commissionerEvents: commissionerRealtime.events,
          ownerEvents: ownerRealtime.events,
        },
        null,
        2
      )
    );
    throw realtimeError;
  }

  const completedDraft = await selectRows(
    commissioner
      .from("drafts")
      .select("current_pick,status")
      .eq("id", draftId)
      .single(),
    "completed draft"
  );
  assert.equal(completedDraft.current_pick, 5);
  assert.equal(completedDraft.status, "complete");

  const completedPicks = await selectRows(
    commissioner
      .from("picks")
      .select("team_id,overall_pick_number")
      .eq("draft_id", draftId)
      .order("overall_pick_number"),
    "completed picks"
  );
  assert.deepEqual(
    completedPicks.map((pick) => pick.team_id),
    [teams[0].id, teams[1].id, teams[1].id, teams[0].id]
  );

  await expectRpcError(
    owner,
    "undo_pick",
    { p_draft_id: draftId },
    "42501"
  );
  await rpc(commissioner, "undo_pick", { p_draft_id: draftId });

  await waitFor(
    () =>
      commissionerRealtime.events.pickDeletes >= 1 &&
      ownerRealtime.events.pickDeletes >= 1 &&
      commissionerRealtime.events.draftUpdates >= 5 &&
      ownerRealtime.events.draftUpdates >= 5,
    "both clients to receive undo updates"
  );

  const rewoundDraft = await selectRows(
    commissioner
      .from("drafts")
      .select("current_pick,status")
      .eq("id", draftId)
      .single(),
    "rewound draft"
  );
  assert.equal(rewoundDraft.current_pick, 4);
  assert.equal(rewoundDraft.status, "active");

  const remainingPicks = await selectRows(
    commissioner
      .from("picks")
      .select("id", { count: "exact" })
      .eq("draft_id", draftId),
    "remaining picks"
  );
  assert.equal(remainingPicks.length, 3);

  console.log(
    JSON.stringify(
      {
        authorizationChecks: "passed",
        lifecycleChecks: "passed",
        timerChecks: "passed",
        duplicatePlayerCheck: "passed",
        picks: "4 inserted, 1 undone",
        realtime: {
          commissioner: commissionerRealtime.events,
          owner: ownerRealtime.events,
        },
        snakeOrder: "passed",
      },
      null,
      2
    )
  );
} finally {
  await Promise.allSettled(
    subscriptions.map(([client, channel]) => client.removeChannel(channel))
  );

  if (draftId) {
    await admin.from("drafts").delete().eq("id", draftId);
  }

  await Promise.allSettled(
    createdUserIds.map((userId) => admin.auth.admin.deleteUser(userId))
  );
}
