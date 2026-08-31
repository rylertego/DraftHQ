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
  const league = await selectRows(
    admin.from("leagues").select("id,name").limit(1).single(),
    "league"
  );
  const removed = await cleanup({ leagueId: league.id });
  console.log(`Cleanup complete: ${JSON.stringify(removed)}`);
  process.exit(0);
}

console.log("Simulation not implemented yet.");
