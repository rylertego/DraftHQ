import type {
  Draft,
  DraftParticipant,
  DraftRole,
  DraftStatus,
  Team,
} from "@/types/draft";
import { ensureAnonymousUser, supabase } from "@/lib/supabase";

interface DraftRow {
  id: string;
  name: string;
  join_code: string;
  commissioner_user_id: string;
  team_count: number;
  rounds: number;
  current_pick: number;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
}

interface ParticipantRow {
  id: string;
  draft_id: string;
  user_id: string;
  team_id: string | null;
  display_name: string;
  role: DraftRole;
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
  participants: DraftParticipant[];
  currentUserId: string;
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
    joinCode: row.join_code,
    commissionerUserId: row.commissioner_user_id,
    teamCount: row.team_count,
    rounds: row.rounds,
    currentPick: row.current_pick,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapParticipant(row: ParticipantRow): DraftParticipant {
  return {
    id: row.id,
    draftId: row.draft_id,
    userId: row.user_id,
    teamId: row.team_id,
    displayName: row.display_name,
    role: row.role,
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
  const currentUser = await ensureAnonymousUser();

  const [draftResult, teamsResult, participantsResult] = await Promise.all([
    supabase
      .from("drafts")
      .select(
        "id,name,join_code,commissioner_user_id,team_count,rounds,current_pick,status,created_at,updated_at"
      )
      .eq("id", draftId)
      .single(),
    supabase
      .from("teams")
      .select("id,draft_id,name,draft_position,logo_url")
      .eq("draft_id", draftId)
      .order("draft_position"),
    supabase
      .from("draft_participants")
      .select(
        "id,draft_id,user_id,team_id,display_name,role,created_at,updated_at"
      )
      .eq("draft_id", draftId)
      .order("created_at"),
  ]);

  if (draftResult.error) {
    throw draftResult.error;
  }

  if (teamsResult.error) {
    throw teamsResult.error;
  }

  if (participantsResult.error) {
    throw participantsResult.error;
  }

  return {
    draft: mapDraft(draftResult.data as DraftRow),
    teams: (teamsResult.data as TeamRow[]).map(mapTeam),
    participants: (participantsResult.data as ParticipantRow[]).map(
      mapParticipant
    ),
    currentUserId: currentUser.id,
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

export async function joinDraft(joinCode: string, displayName: string) {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("join_draft", {
    p_join_code: joinCode,
    p_display_name: displayName,
  });

  if (error) {
    throw error;
  }

  return mapParticipant(
    getSingleRow<ParticipantRow>(data, "the draft participant")
  );
}

export async function assignTeam(
  draftId: string,
  participantId: string,
  teamId: string | null
) {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("assign_team", {
    p_draft_id: draftId,
    p_participant_id: participantId,
    p_team_id: teamId,
  });

  if (error) {
    throw error;
  }

  return mapParticipant(
    getSingleRow<ParticipantRow>(data, "the updated participant")
  );
}
