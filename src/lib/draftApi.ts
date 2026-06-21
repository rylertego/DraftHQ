import type {
  Draft,
  DraftInvitation,
  DraftParticipant,
  DraftRole,
  DraftStatus,
  Pick,
  Player,
  PlayerPosition,
  Team,
} from "@/types/draft";
import { ensureAnonymousUser, supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profileApi";
import type { SleeperLeaguePreview } from "@/lib/sleeper";

interface DraftRow {
  id: string;
  name: string;
  join_code: string;
  commissioner_user_id: string;
  team_count: number;
  rounds: number;
  current_pick: number;
  status: DraftStatus;
  pick_seconds: number;
  pick_deadline_at: string | null;
  paused_remaining_seconds: number | null;
  sleeper_league_id: string | null;
  sleeper_draft_id: string | null;
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

interface InvitationRow {
  id: string;
  draft_id: string;
  email: string;
  team_id: string | null;
  status: "pending" | "accepted";
  participant_id: string | null;
  invited_at: string;
  accepted_at: string | null;
}

interface TeamRow {
  id: string;
  draft_id: string;
  name: string;
  draft_position: number;
  logo_url: string | null;
  sleeper_roster_id: number | null;
  sleeper_owner_user_id: string | null;
}

interface PlayerRow {
  id: string;
  source: string;
  external_id: string | null;
  full_name: string;
  position: PlayerPosition;
  nfl_team: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface PickPlayerRow {
  full_name: string;
  position: PlayerPosition;
  nfl_team: string | null;
}

interface PickRow {
  id: string;
  draft_id: string;
  team_id: string;
  player_id: string;
  participant_id: string | null;
  round: number;
  pick_number: number;
  overall_pick_number: number;
  created_at: string;
  players: PickPlayerRow | PickPlayerRow[];
}

export interface DraftSetup {
  draft: Draft;
  teams: Team[];
  participants: DraftParticipant[];
  invitations: DraftInvitation[];
  currentUserId: string;
}

export interface DraftRoomSnapshot extends DraftSetup {
  picks: Pick[];
  players: Player[];
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
    pickSeconds: row.pick_seconds,
    pickDeadlineAt: row.pick_deadline_at,
    pausedRemainingSeconds: row.paused_remaining_seconds,
    sleeperLeagueId: row.sleeper_league_id,
    sleeperDraftId: row.sleeper_draft_id,
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

function mapInvitation(row: InvitationRow): DraftInvitation {
  return {
    id: row.id,
    draftId: row.draft_id,
    email: row.email,
    teamId: row.team_id,
    status: row.status,
    participantId: row.participant_id,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at,
  };
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    draftId: row.draft_id,
    name: row.name,
    draftPosition: row.draft_position,
    logoUrl: row.logo_url ?? undefined,
    sleeperRosterId: row.sleeper_roster_id ?? undefined,
    sleeperOwnerUserId: row.sleeper_owner_user_id ?? undefined,
  };
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id ?? undefined,
    fullName: row.full_name,
    position: row.position,
    nflTeam: row.nfl_team ?? undefined,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPick(row: PickRow): Pick {
  const player = Array.isArray(row.players) ? row.players[0] : row.players;

  if (!player) {
    throw new Error(`Player data is missing for pick ${row.id}.`);
  }

  return {
    id: row.id,
    draftId: row.draft_id,
    teamId: row.team_id,
    playerId: row.player_id,
    participantId: row.participant_id ?? undefined,
    round: row.round,
    pickNumber: row.pick_number,
    overallPickNumber: row.overall_pick_number,
    playerName: player.full_name,
    playerPosition: player.position,
    nflTeam: player.nfl_team ?? undefined,
    createdAt: row.created_at,
  };
}

export async function createDraft(input: {
  name: string;
  teamCount: number;
  rounds: number;
}) {
  const { profile } = await getMyProfile();

  const { data, error } = await supabase.rpc("create_draft", {
    p_name: input.name,
    p_team_count: input.teamCount,
    p_rounds: input.rounds,
    p_display_name: profile.displayName,
  });

  if (error) {
    throw error;
  }

  return mapDraft(getSingleRow<DraftRow>(data, "the created draft"));
}

export async function getSleeperLeaguePreview(leagueId: string) {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Authentication session is missing.");
  }

  const response = await fetch(`/api/sleeper/leagues/${leagueId}/preview`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json()) as {
    preview?: SleeperLeaguePreview;
    error?: string;
  };

  if (!response.ok || !payload.preview) {
    throw new Error(payload.error ?? "Unable to preview the Sleeper league.");
  }

  return payload.preview;
}

export async function createSleeperDraft(input: {
  name: string;
  rounds: number;
  preview: SleeperLeaguePreview;
}) {
  const { profile } = await getMyProfile();
  const { data, error } = await supabase.rpc("create_sleeper_draft", {
    p_name: input.name,
    p_rounds: input.rounds,
    p_display_name: profile.displayName,
    p_sleeper_league_id: input.preview.leagueId,
    p_sleeper_draft_id: input.preview.draftId,
    p_team_names: input.preview.teams.map((team) => team.teamName),
    p_sleeper_roster_ids: input.preview.teams.map((team) => team.rosterId),
    p_sleeper_owner_user_ids: input.preview.teams.map(
      (team) => team.ownerUserId ?? ""
    ),
  });

  if (error) {
    throw error;
  }

  return mapDraft(getSingleRow<DraftRow>(data, "the imported draft"));
}

export async function getDraftSetup(draftId: string): Promise<DraftSetup> {
  const currentUser = await ensureAnonymousUser();

  const [draftResult, teamsResult, participantsResult, invitationsResult] =
    await Promise.all([
    supabase
      .from("drafts")
      .select(
        "id,name,join_code,commissioner_user_id,team_count,rounds,current_pick,status,pick_seconds,pick_deadline_at,paused_remaining_seconds,sleeper_league_id,sleeper_draft_id,created_at,updated_at"
      )
      .eq("id", draftId)
      .single(),
    supabase
      .from("teams")
      .select("id,draft_id,name,draft_position,logo_url,sleeper_roster_id,sleeper_owner_user_id")
      .eq("draft_id", draftId)
      .order("draft_position"),
    supabase
      .from("draft_participants")
      .select(
        "id,draft_id,user_id,team_id,display_name,role,created_at,updated_at"
      )
      .eq("draft_id", draftId)
      .order("created_at"),
    supabase
      .from("draft_invitations")
      .select(
        "id,draft_id,email,team_id,status,participant_id,invited_at,accepted_at"
      )
      .eq("draft_id", draftId)
      .order("invited_at"),
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

  if (invitationsResult.error) {
    throw invitationsResult.error;
  }

  return {
    draft: mapDraft(draftResult.data as DraftRow),
    teams: (teamsResult.data as TeamRow[]).map(mapTeam),
    participants: (participantsResult.data as ParticipantRow[]).map(
      mapParticipant
    ),
    invitations: (invitationsResult.data as InvitationRow[]).map(
      mapInvitation
    ),
    currentUserId: currentUser.id,
  };
}

export async function inviteOwner(
  draftId: string,
  email: string,
  teamId: string
) {
  await ensureAnonymousUser();
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("Authentication session is missing.");
  }

  const response = await fetch(`/api/drafts/${draftId}/invitations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, teamId }),
  });
  const payload = (await response.json()) as {
    invitation?: InvitationRow;
    error?: string;
  };

  if (!response.ok || !payload.invitation) {
    throw new Error(payload.error ?? "Unable to invite owner.");
  }

  return mapInvitation(payload.invitation);
}

export async function updateTeamSetup(draftId: string, teams: Team[]) {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("update_team_setup", {
    p_draft_id: draftId,
    p_team_ids: teams.map((team) => team.id),
    p_team_names: teams.map((team) => team.name.trim()),
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

export async function getDraftRoomSnapshot(
  draftId: string
): Promise<DraftRoomSnapshot> {
  await ensureAnonymousUser();

  const [setup, picksResult, playersResult] = await Promise.all([
    getDraftSetup(draftId),
    supabase
      .from("picks")
      .select(
        "id,draft_id,team_id,player_id,participant_id,round,pick_number,overall_pick_number,created_at,players(full_name,position,nfl_team)"
      )
      .eq("draft_id", draftId)
      .order("overall_pick_number"),
    supabase
      .from("players")
      .select(
        "id,source,external_id,full_name,position,nfl_team,active,created_at,updated_at"
      )
      .eq("active", true)
      .order("full_name"),
  ]);

  if (picksResult.error) {
    throw picksResult.error;
  }

  if (playersResult.error) {
    throw playersResult.error;
  }

  return {
    ...setup,
    picks: (picksResult.data as unknown as PickRow[]).map(mapPick),
    players: (playersResult.data as PlayerRow[]).map(mapPlayer),
  };
}

export async function makePick(draftId: string, playerId: string) {
  await ensureAnonymousUser();

  const { error } = await supabase.rpc("make_pick", {
    p_draft_id: draftId,
    p_player_id: playerId,
  });

  if (error) {
    throw error;
  }
}

export async function commissionerMakePick(draftId: string, playerId: string) {
  await ensureAnonymousUser();

  const { error } = await supabase.rpc("commissioner_make_pick", {
    p_draft_id: draftId,
    p_player_id: playerId,
  });

  if (error) {
    throw error;
  }
}

export async function removeDraftParticipant(
  draftId: string,
  participantId: string
) {
  await ensureAnonymousUser();

  const { error } = await supabase.rpc("remove_draft_participant", {
    p_draft_id: draftId,
    p_participant_id: participantId,
  });

  if (error) {
    throw error;
  }
}

export async function undoPick(draftId: string) {
  await ensureAnonymousUser();

  const { error } = await supabase.rpc("undo_pick", {
    p_draft_id: draftId,
  });

  if (error) {
    throw error;
  }
}

async function runDraftLifecycleRpc(
  name: "start_draft" | "pause_draft" | "resume_draft",
  draftId: string
) {
  await ensureAnonymousUser();
  const { error } = await supabase.rpc(name, { p_draft_id: draftId });

  if (error) {
    throw error;
  }
}

export async function startDraft(draftId: string) {
  return runDraftLifecycleRpc("start_draft", draftId);
}

export async function pauseDraft(draftId: string) {
  return runDraftLifecycleRpc("pause_draft", draftId);
}

export async function resumeDraft(draftId: string) {
  return runDraftLifecycleRpc("resume_draft", draftId);
}

export async function configureDraftTimer(
  draftId: string,
  pickSeconds: number
) {
  await ensureAnonymousUser();
  const { error } = await supabase.rpc("configure_draft_timer", {
    p_draft_id: draftId,
    p_pick_seconds: pickSeconds,
  });

  if (error) {
    throw error;
  }
}
