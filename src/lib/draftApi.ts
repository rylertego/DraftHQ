import type { Draft, DraftStatus, Team } from "@/types/draft";
import { ensureAnonymousUser, supabase } from "@/lib/supabase";

interface DraftRow {
  id: string;
  name: string;
  team_count: number;
  rounds: number;
  current_pick: number;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
}

interface TeamRow {
  id: string;
  draft_id: string;
  name: string;
  draft_position: number;
  logo_url: string | null;
}

export interface DraftSetup {
  draft: Draft;
  teams: Team[];
}

function getSingleRow<T>(data: unknown, description: string): T {
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") {
    throw new Error(`Supabase did not return ${description}.`);
  }

  return row as T;
}

function mapDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    name: row.name,
    teamCount: row.team_count,
    rounds: row.rounds,
    currentPick: row.current_pick,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    draftId: row.draft_id,
    name: row.name,
    draftPosition: row.draft_position,
    logoUrl: row.logo_url ?? undefined,
  };
}

export async function createDraft(input: {
  name: string;
  teamCount: number;
  rounds: number;
}) {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("create_draft", {
    p_name: input.name,
    p_team_count: input.teamCount,
    p_rounds: input.rounds,
    p_display_name: "Commissioner",
  });

  if (error) {
    throw error;
  }

  return mapDraft(getSingleRow<DraftRow>(data, "the created draft"));
}

export async function getDraftSetup(draftId: string): Promise<DraftSetup> {
  await ensureAnonymousUser();

  const [draftResult, teamsResult] = await Promise.all([
    supabase
      .from("drafts")
      .select(
        "id,name,team_count,rounds,current_pick,status,created_at,updated_at"
      )
      .eq("id", draftId)
      .single(),
    supabase
      .from("teams")
      .select("id,draft_id,name,draft_position,logo_url")
      .eq("draft_id", draftId)
      .order("draft_position"),
  ]);

  if (draftResult.error) {
    throw draftResult.error;
  }

  if (teamsResult.error) {
    throw teamsResult.error;
  }

  return {
    draft: mapDraft(draftResult.data as DraftRow),
    teams: (teamsResult.data as TeamRow[]).map(mapTeam),
  };
}

export async function renameTeams(draftId: string, teamNames: string[]) {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("rename_teams", {
    p_draft_id: draftId,
    p_team_names: teamNames,
  });

  if (error) {
    throw error;
  }

  return (data as TeamRow[]).map(mapTeam);
}
