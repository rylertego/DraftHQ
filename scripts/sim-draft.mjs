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
    const { data: deletedDrafts, error } = await admin
      .from("drafts")
      .delete()
      .eq("id", draftId)
      .select("id");
    if (error) throw error;
    removed.drafts += deletedDrafts?.length ?? 0;
  }

  if (seasonId) {
    const { data: deletedSeasons, error } = await admin
      .from("league_seasons")
      .delete()
      .eq("id", seasonId)
      .select("id");
    if (error) throw error;
    removed.seasons += deletedSeasons?.length ?? 0;
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
        const { data: deletedDrafts, error } = await admin
          .from("drafts")
          .delete()
          .eq("id", stray.draft_id)
          .select("id");
        if (error) throw error;
        removed.drafts += deletedDrafts?.length ?? 0;
      }
      const { data: deletedSeasons, error: seasonError } = await admin
        .from("league_seasons")
        .delete()
        .eq("id", stray.id)
        .select("id");
      if (seasonError) throw seasonError;
      removed.seasons += deletedSeasons?.length ?? 0;
    }
  }

  // Simulated users, found by email prefix so no bookkeeping is needed.
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of listed?.users ?? []) {
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
