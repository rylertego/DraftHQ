import pg from "pg";
import { getLocalSupabaseEnvironment } from "./local-supabase-env.mjs";

const { Client } = pg;

const requiredTables = [
  "draft_invitations",
  "draft_participants",
  "drafts",
  "picks",
  "players",
  "profiles",
  "teams",
];

const requiredFunctions = [
  "assign_team(uuid, uuid, uuid)",
  "commissioner_make_pick(uuid, uuid, integer)",
  "configure_draft_timer(uuid, integer)",
  "create_draft(text, integer, integer, text)",
  "create_sleeper_draft(text, integer, text, text, text, text[], integer[], text[])",
  "get_draft_server_time(uuid)",
  "join_draft(text, text)",
  "make_pick(uuid, uuid, integer)",
  "pause_draft(uuid)",
  "remove_draft_participant(uuid, uuid)",
  "replace_nflverse_players(jsonb)",
  "resume_draft(uuid)",
  "start_draft(uuid)",
  "undo_pick(uuid)",
  "update_team_setup(uuid, uuid[], text[])",
];

const requiredRealtimeTables = [
  "draft_invitations",
  "draft_participants",
  "drafts",
  "picks",
  "teams",
];

const requiredConstraints = [
  "draft_invitations_draft_id_email_key",
  "draft_participants_draft_id_user_id_key",
  "picks_draft_id_overall_pick_number_key",
  "picks_draft_id_player_id_key",
  "players_source_external_id_key",
  "teams_draft_id_draft_position_key",
];

const requiredIndexes = [
  "draft_invitations_team_assignment_idx",
  "draft_participants_team_assignment_idx",
  "picks_draft_order_idx",
  "players_name_search_idx",
  "teams_sleeper_roster_id_idx",
];

function findMissing(actualValues, requiredValues) {
  const actual = new Set(actualValues);
  return requiredValues.filter((value) => !actual.has(value));
}

function requireValues(label, actualValues, requiredValues, failures) {
  const missing = findMissing(actualValues, requiredValues);

  if (missing.length > 0) {
    failures.push(`${label}: missing ${missing.join(", ")}`);
    return;
  }

  console.log(`PASS ${label} (${requiredValues.length})`);
}

async function verifyMigrations() {
  const environment = getLocalSupabaseEnvironment();
  const client = new Client({ connectionString: environment.DB_URL });
  const failures = [];

  await client.connect();

  try {
    const tables = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
    `);
    const functions = await client.query(`
      select
        p.proname || '(' || pg_catalog.oidvectortypes(p.proargtypes) || ')'
          as signature
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    `);
    const publication = await client.query(`
      select tablename
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public'
    `);
    const constraints = await client.query(`
      select c.conname
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public'
    `);
    const indexes = await client.query(`
      select indexname
      from pg_catalog.pg_indexes
      where schemaname = 'public'
    `);
    const seed = await client.query(`
      select
        count(*)::integer as player_count,
        count(*) filter (
          where id = md5('drafthq-' || external_id)::uuid
            and active
        )::integer as valid_player_count
      from public.players
      where source = 'test'
        and external_id ~ '^test-player-[0-9]{3}$'
    `);

    requireValues(
      "required tables",
      tables.rows.map((row) => row.table_name),
      requiredTables,
      failures
    );
    requireValues(
      "required RPC functions",
      functions.rows.map((row) => row.signature),
      requiredFunctions,
      failures
    );
    requireValues(
      "Realtime publication tables",
      publication.rows.map((row) => row.tablename),
      requiredRealtimeTables,
      failures
    );
    requireValues(
      "required constraints",
      constraints.rows.map((row) => row.conname),
      requiredConstraints,
      failures
    );
    requireValues(
      "required indexes",
      indexes.rows.map((row) => row.indexname),
      requiredIndexes,
      failures
    );

    const seededPlayers = seed.rows[0];
    if (
      seededPlayers.player_count !== 600 ||
      seededPlayers.valid_player_count !== 600
    ) {
      failures.push(
        `deterministic seed players: expected 600 valid rows, found ${seededPlayers.valid_player_count} of ${seededPlayers.player_count}`
      );
    } else {
      console.log("PASS deterministic seed players (600)");
    }
  } finally {
    await client.end();
  }

  if (failures.length > 0) {
    throw new Error(`Migration verification failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("Local migration verification passed.");
}

verifyMigrations().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
