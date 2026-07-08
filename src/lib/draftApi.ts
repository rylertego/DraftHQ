import type {
  Draft,
  DraftInvitation,
  DraftMessage,
  DraftParticipant,
  DraftRole,
  DraftStatus,
  MessageKind,
  Pick,
  Player,
  PlayerPosition,
  RosterPosition,
  Team,
  TimerBehavior,
  WalkUpSong,
} from "@/types/draft";
import { buildByeWeekLookup } from "@/lib/nflTeams";
import { ensureAnonymousUser, supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profileApi";
import type { SleeperLeaguePreview } from "@/lib/sleeper";

interface DraftRow {
  id: string;
  name: string;
  join_code: string;
  commissioner_user_id: string;
  league_id: string | null;
  team_count: number;
  rounds: number;
  current_pick: number;
  status: DraftStatus;
  pick_seconds: number;
  pick_deadline_at: string | null;
  paused_remaining_seconds: number | null;
  timer_behavior: TimerBehavior;
  clock_extension_seconds: number;
  max_clock_extensions: number;
  clock_extensions_used: number;
  sleeper_league_id: string | null;
  sleeper_draft_id: string | null;
  scheduled_at: string | null;
  scheduled_timezone: string | null;
  roster_positions: unknown | null;
  scoring_type: "standard" | "ppr" | "half_ppr" | "superflex";
  use_landmines: boolean;
  landmine_count: number;
  hide_player_rankings: boolean;
  sfx_1_url: string | null;
  sfx_2_url: string | null;
  pos_reactions: string[] | null;
  neg_reactions: string[] | null;
  pick_is_in_enabled: boolean;
  pick_is_in_sfx_url: string | null;
  draft_start_audio_url: string | null;
  show_round_slide: boolean;
  round_slide_seconds: number;
  round_slide_pauses_clock: boolean;
  announcer_voice_uri: string | null;
  walk_up_music_mode: "restart" | "resume" | null;
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
  short_name: string | null;
  tts_name: string | null;
  autodraft: boolean;
  pre_draft_notes: string | null;
  last_season_pick: number | null;
  last_season_record: string | null;
  last_season_playoffs: boolean | null;
  owner_name: string | null;
  owner_photo_url: string | null;
  clock_extensions_used: number;
  last_season_pick_player: string | null;
  walk_up_songs: WalkUpSong[];
}

interface PlayerRow {
  id: string;
  source: string;
  external_id: string | null;
  full_name: string;
  position: PlayerPosition;
  nfl_team: string | null;
  rank: number | null;
  headshot_url: string | null;
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
  is_landmine: boolean;
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
  serverTimeOffsetMs: number;
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
    leagueId: row.league_id,
    teamCount: row.team_count,
    rounds: row.rounds,
    currentPick: row.current_pick,
    status: row.status,
    pickSeconds: row.pick_seconds,
    pickDeadlineAt: row.pick_deadline_at,
    pausedRemainingSeconds: row.paused_remaining_seconds,
    timerBehavior: row.timer_behavior,
    clockExtensionSeconds: row.clock_extension_seconds,
    maxClockExtensions: row.max_clock_extensions,
    clockExtensionsUsed: row.clock_extensions_used,
    sleeperLeagueId: row.sleeper_league_id,
    sleeperDraftId: row.sleeper_draft_id,
    scheduledAt: row.scheduled_at ?? null,
    scheduledTimezone: row.scheduled_timezone ?? null,
    rosterPositions: (row.roster_positions as RosterPosition[] | null) ?? null,
    scoringType: row.scoring_type ?? "standard",
    useLandmines: row.use_landmines ?? false,
    landmineCount: row.landmine_count ?? 3,
    hidePlayerRankings: row.hide_player_rankings ?? false,
    sfx1Url: row.sfx_1_url ?? null,
    sfx2Url: row.sfx_2_url ?? null,
    posReactions: row.pos_reactions ?? null,
    negReactions: row.neg_reactions ?? null,
    pickIsInEnabled: row.pick_is_in_enabled ?? true,
    pickIsInSfxUrl: row.pick_is_in_sfx_url ?? null,
    draftStartAudioUrl: row.draft_start_audio_url ?? null,
    showRoundSlide: row.show_round_slide ?? true,
    roundSlideSeconds: row.round_slide_seconds ?? 7,
    roundSlidePausesClock: row.round_slide_pauses_clock ?? false,
    announcerVoiceUri: row.announcer_voice_uri ?? null,
    walkUpMusicMode: row.walk_up_music_mode ?? "restart",
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
    shortName: row.short_name ?? undefined,
    ttsName: row.tts_name ?? undefined,
    autodraft: row.autodraft ?? false,
    preDraftNotes: row.pre_draft_notes ?? undefined,
    lastSeasonPick: row.last_season_pick ?? undefined,
    lastSeasonRecord: row.last_season_record ?? undefined,
    lastSeasonPlayoffs: row.last_season_playoffs ?? undefined,
    ownerName: row.owner_name ?? undefined,
    ownerPhotoUrl: row.owner_photo_url ?? undefined,
    clockExtensionsUsed: row.clock_extensions_used ?? 0,
    lastSeasonPickPlayer: row.last_season_pick_player ?? undefined,
    walkUpSongs: Array.isArray(row.walk_up_songs) ? (row.walk_up_songs as WalkUpSong[]) : [],
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
    rank: row.rank ?? undefined,
    headshotUrl: row.headshot_url ?? undefined,
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
    isLandmine: row.is_landmine ?? false,
    createdAt: row.created_at,
  };
}

export async function createDraft(input: {
  name: string;
  teamCount: number;
  rounds: number;
  leagueId?: string;
}) {
  const { profile } = await getMyProfile();

  const parameters = {
    p_name: input.name,
    p_team_count: input.teamCount,
    p_rounds: input.rounds,
    p_display_name: profile.displayName,
  };
  const { data, error } = input.leagueId
    ? await supabase.rpc("create_league_draft", {
        ...parameters,
        p_league_id: input.leagueId,
      })
    : await supabase.rpc("create_draft", parameters);

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
        "id,name,join_code,commissioner_user_id,league_id,team_count,rounds,current_pick,status,pick_seconds,pick_deadline_at,paused_remaining_seconds,timer_behavior,clock_extension_seconds,max_clock_extensions,clock_extensions_used,sleeper_league_id,sleeper_draft_id,scheduled_at,scheduled_timezone,roster_positions,scoring_type,use_landmines,landmine_count,hide_player_rankings,sfx_1_url,sfx_2_url,pos_reactions,neg_reactions,pick_is_in_enabled,pick_is_in_sfx_url,draft_start_audio_url,show_round_slide,round_slide_seconds,round_slide_pauses_clock,announcer_voice_uri,walk_up_music_mode,created_at,updated_at"
      )
      .eq("id", draftId)
      .single(),
    supabase
      .from("teams")
      .select("id,draft_id,name,draft_position,logo_url,owner_photo_url,sleeper_roster_id,sleeper_owner_user_id,short_name,tts_name,autodraft,pre_draft_notes,last_season_pick,last_season_record,last_season_playoffs,owner_name,clock_extensions_used,last_season_pick_player,walk_up_songs")
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
  teamId: string,
  options: { sendEmail?: boolean } = {}
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
    body: JSON.stringify({
      email,
      teamId,
      sendEmail: options.sendEmail ?? true,
    }),
  });
  const payload = (await response.json()) as {
    invitation?: InvitationRow;
    warning?: string | null;
    error?: string;
  };

  if (!response.ok || !payload.invitation) {
    throw new Error(payload.error ?? "Unable to invite owner.");
  }

  return {
    invitation: mapInvitation(payload.invitation),
    warning: payload.warning ?? null,
  };
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

export async function getDraftServerTimeOffsetMs(draftId: string): Promise<number> {
  const startedAt = Date.now();
  const { data, error } = await supabase.rpc("get_draft_server_time", { p_draft_id: draftId });
  const completedAt = Date.now();
  if (error) throw error;
  const serverTimeMs = Date.parse(data as string);
  if (!Number.isFinite(serverTimeMs)) throw new Error("Invalid server time.");
  return serverTimeMs - (startedAt + completedAt) / 2;
}

async function getActivePlayersWithOptionalHeadshots() {
  const runQuery = (columns: string) => supabase
    .from("players")
    .select(columns)
    .eq("active", true)
    .order("rank", { ascending: true, nullsFirst: false })
    .order("full_name");

  const withHeadshots = await runQuery(
    "id,source,external_id,full_name,position,nfl_team,rank,headshot_url,active,created_at,updated_at"
  );

  if (
    !withHeadshots.error ||
    (withHeadshots.error.code !== "42703" && !withHeadshots.error.message.includes("headshot_url"))
  ) {
    return withHeadshots;
  }

  // Keep active draft rooms usable while the additive headshot migration is
  // rolling out. Once the column exists, the first query is used normally.
  return runQuery(
    "id,source,external_id,full_name,position,nfl_team,rank,active,created_at,updated_at"
  );
}

export async function getDraftRoomSnapshot(
  draftId: string
): Promise<DraftRoomSnapshot> {
  await ensureAnonymousUser();

  const serverTimePromise = (async () => {
    const startedAt = Date.now();
    const { data, error } = await supabase.rpc("get_draft_server_time", {
      p_draft_id: draftId,
    });
    const completedAt = Date.now();

    if (error) {
      throw error;
    }

    const serverTimeMs = Date.parse(data as string);
    if (!Number.isFinite(serverTimeMs)) {
      throw new Error("Supabase returned an invalid draft server time.");
    }

    return serverTimeMs - (startedAt + completedAt) / 2;
  })();

  const [setup, picksResult, playersResult, serverTimeOffsetMs] =
    await Promise.all([
      getDraftSetup(draftId),
      supabase
        .from("picks")
        .select(
          "id,draft_id,team_id,player_id,participant_id,round,pick_number,overall_pick_number,is_landmine,created_at,players(full_name,position,nfl_team)"
        )
        .eq("draft_id", draftId)
        .order("overall_pick_number"),
      getActivePlayersWithOptionalHeadshots(),
      serverTimePromise,
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
    players: (playersResult.data as unknown as PlayerRow[]).map(mapPlayer),
    serverTimeOffsetMs,
  };
}

export async function getDraftRevision(draftId: string) {
  await ensureAnonymousUser();

  const { data, error } = await supabase
    .from("drafts")
    .select("updated_at")
    .eq("id", draftId)
    .single();

  if (error) {
    throw error;
  }

  return data.updated_at;
}

export async function makePick(
  draftId: string,
  playerId: string,
  expectedPick: number
) {
  await ensureAnonymousUser();

  const { error } = await supabase.rpc("make_pick", {
    p_draft_id: draftId,
    p_player_id: playerId,
    p_expected_pick: expectedPick,
  });

  if (error) {
    throw error;
  }
}

export async function commissionerMakePick(
  draftId: string,
  playerId: string,
  expectedPick: number
) {
  await ensureAnonymousUser();

  const { error } = await supabase.rpc("commissioner_make_pick", {
    p_draft_id: draftId,
    p_player_id: playerId,
    p_expected_pick: expectedPick,
  });

  if (error) {
    throw error;
  }
}

export async function commissionerEditPick(
  draftId: string,
  overallPickNumber: number,
  newPlayerId: string,
  newTeamId?: string
) {
  await ensureAnonymousUser();

  const { error } = await supabase.rpc("commissioner_edit_pick", {
    p_draft_id: draftId,
    p_overall_pick_number: overallPickNumber,
    p_new_player_id: newPlayerId,
    p_new_team_id: newTeamId ?? null,
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
  const { data, error } = await supabase.rpc(name, { p_draft_id: draftId });

  if (error) {
    throw error;
  }

  return mapDraft(getSingleRow<DraftRow>(data, "the updated draft"));
}

export async function updateDraftSchedule(draftId: string, scheduledAt: string | null, timezone: string | null): Promise<Draft> {
  await ensureAnonymousUser();
  if (scheduledAt === null) {
    const { data, error } = await supabase.rpc("clear_draft_schedule", { p_draft_id: draftId });
    if (error) throw new Error(error.message);
    return mapDraft(data as DraftRow);
  }
  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_scheduled_at: scheduledAt,
    p_scheduled_tz: timezone,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
}

export async function updateDraftRosterPositions(draftId: string, positions: RosterPosition[]): Promise<Draft> {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_roster_positions: positions,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
}

export async function updateDraftAudio(
  draftId: string,
  audio: Partial<{ sfx1Url: string | null; sfx2Url: string | null; posReactions: string[]; negReactions: string[] }>
): Promise<Draft> {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_sfx_1_url: audio.sfx1Url ?? null,
    p_sfx_2_url: audio.sfx2Url ?? null,
    p_pos_reactions: audio.posReactions ?? null,
    p_neg_reactions: audio.negReactions ?? null,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
}

export async function updateDraftPresentation(
  draftId: string,
  settings: Partial<{
    pickIsInEnabled: boolean;
    pickIsInSfxUrl: string | null;
    draftStartAudioUrl: string | null;
    showRoundSlide: boolean;
    roundSlideSeconds: number;
    roundSlidePausesClock: boolean;
    announcerVoiceUri: string | null;
    walkUpMusicMode: "restart" | "resume";
  }>
): Promise<Draft> {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_pick_is_in_enabled: settings.pickIsInEnabled ?? null,
    p_pick_is_in_sfx_url: settings.pickIsInSfxUrl ?? null,
    p_draft_start_audio_url: settings.draftStartAudioUrl ?? null,
    p_show_round_slide: settings.showRoundSlide ?? null,
    p_round_slide_seconds: settings.roundSlideSeconds ?? null,
    p_round_slide_pauses_clock: settings.roundSlidePausesClock ?? null,
    p_announcer_voice_uri: settings.announcerVoiceUri ?? null,
    p_walk_up_music_mode: settings.walkUpMusicMode ?? null,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
}

export async function updateDraftExtras(
  draftId: string,
  extras: Partial<{ scoringType: Draft["scoringType"]; useLandmines: boolean; landmineCount: number; hidePlayerRankings: boolean }>
): Promise<Draft> {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_scoring_type: extras.scoringType ?? null,
    p_use_landmines: extras.useLandmines ?? null,
    p_landmine_count: extras.landmineCount ?? null,
    p_hide_rankings: extras.hidePlayerRankings ?? null,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
}

export async function updateTeamDetails(
  draftId: string,
  teamId: string,
  details: Partial<{
    shortName: string;
    ttsName: string;
    autodraft: boolean;
    preDraftNotes: string;
    lastSeasonPick: number;
    lastSeasonRecord: string;
    lastSeasonPlayoffs: boolean;
    ownerName: string;
    lastSeasonPickPlayer: string;
    walkUpSongs: WalkUpSong[];
  }>
): Promise<Team> {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("update_team_details", {
    p_draft_id: draftId,
    p_team_id: teamId,
    p_short_name: details.shortName ?? null,
    p_tts_name: details.ttsName ?? null,
    p_autodraft: details.autodraft ?? null,
    p_pre_draft_notes: details.preDraftNotes ?? null,
    p_last_season_pick: details.lastSeasonPick ?? null,
    p_last_season_record: details.lastSeasonRecord ?? null,
    p_last_season_playoffs: details.lastSeasonPlayoffs ?? null,
    p_owner_name: details.ownerName ?? null,
    p_last_season_pick_player: details.lastSeasonPickPlayer ?? null,
    p_walk_up_songs: details.walkUpSongs !== undefined ? details.walkUpSongs : null,
  });
  if (error) throw new Error(error.message);
  return mapTeam(data as TeamRow);
}

export async function uploadDraftTeamLogo(draftId: string, teamId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${draftId}/${teamId}/logo.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("draft-team-logos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("draft-team-logos").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  const { error } = await supabase.from("teams").update({ logo_url: url }).eq("id", teamId).eq("draft_id", draftId);
  if (error) throw error;
  return url;
}

export async function uploadDraftOwnerPhoto(draftId: string, teamId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${draftId}/${teamId}/owner.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("draft-owner-photos")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("draft-owner-photos").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;
  const { error } = await supabase.from("teams").update({ owner_photo_url: url }).eq("id", teamId).eq("draft_id", draftId);
  if (error) throw error;
  return url;
}

export async function uploadDraftSfx(draftId: string, slot: 1 | 2, file: File): Promise<string> {
  await ensureAnonymousUser();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
  const path = `${draftId}/sfx${slot}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("draft-audio")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("draft-audio").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadDraftPresentationAudio(draftId: string, slot: "pickIsIn" | "draftStart", file: File): Promise<string> {
  await ensureAnonymousUser();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
  const path = `${draftId}/${slot}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("draft-audio")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("draft-audio").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function updateDraftRounds(draftId: string, rounds: number): Promise<Draft> {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_rounds: rounds,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
}

export async function updateDraftTeamCount(draftId: string, teamCount: number): Promise<Draft> {
  await ensureAnonymousUser();
  if (teamCount < 2 || teamCount > 32) throw new Error("Team count must be between 2 and 32.");

  const { data: existingTeams, error: fetchError } = await supabase
    .from("teams")
    .select("id,draft_position")
    .eq("draft_id", draftId)
    .order("draft_position");
  if (fetchError) throw new Error(fetchError.message);

  const current = (existingTeams as { id: string; draft_position: number }[]) ?? [];

  if (teamCount > current.length) {
    const inserts = Array.from({ length: teamCount - current.length }, (_, i) => ({
      draft_id: draftId,
      name: `Team ${current.length + i + 1}`,
      draft_position: current.length + i + 1,
    }));
    const { error: insertError } = await supabase.from("teams").insert(inserts);
    if (insertError) throw new Error(insertError.message);
  } else if (teamCount < current.length) {
    const toRemove = current.slice(teamCount).map((t) => t.id);
    const { error: deleteError } = await supabase.from("teams").delete().in("id", toRemove);
    if (deleteError) throw new Error(deleteError.message);
  }

  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_team_count: teamCount,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
}

export async function updateDraftName(draftId: string, name: string): Promise<Draft> {
  await ensureAnonymousUser();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Draft name cannot be empty.");
  const { data, error } = await supabase.rpc("update_draft_extras", {
    p_draft_id: draftId,
    p_name: trimmed,
  });
  if (error) throw new Error(error.message);
  return mapDraft(data as DraftRow);
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
  pickSeconds: number,
  options: {
    timerBehavior?: TimerBehavior;
    clockExtensionSeconds?: number;
    maxClockExtensions?: number;
  } = {}
) {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("configure_draft_timer", {
    p_draft_id: draftId,
    p_pick_seconds: pickSeconds,
    p_timer_behavior: options.timerBehavior ?? null,
    p_clock_extension_seconds: options.clockExtensionSeconds ?? null,
    p_max_clock_extensions: options.maxClockExtensions ?? null,
  });

  if (error) {
    throw error;
  }

  return mapDraft(getSingleRow<DraftRow>(data, "the updated draft"));
}

export async function expireCurrentPick(draftId: string, expectedPick: number) {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("expire_current_pick", {
    p_draft_id: draftId,
    p_expected_pick: expectedPick,
  });

  if (error) {
    throw error;
  }

  return mapDraft(getSingleRow<DraftRow>(data, "the updated draft"));
}

export async function resetDraft(draftId: string): Promise<void> {
  await ensureAnonymousUser();
  const { error } = await supabase.rpc("reset_draft", { p_draft_id: draftId });
  if (error) throw new Error(error.message);
}

export async function resetPickTimer(draftId: string) {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("reset_pick_timer", { p_draft_id: draftId });
  if (error) throw error;
  return mapDraft(getSingleRow<DraftRow>(data, "the updated draft"));
}

export async function extendClock(draftId: string, expectedPick: number) {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("extend_clock", {
    p_draft_id: draftId,
    p_expected_pick: expectedPick,
  });

  if (error) {
    throw error;
  }

  return mapDraft(getSingleRow<DraftRow>(data, "the updated draft"));
}

interface MessageRow {
  id: string;
  draft_id: string;
  participant_id: string | null;
  display_name: string;
  content: string;
  kind: MessageKind;
  created_at: string;
}

function mapMessage(row: MessageRow): DraftMessage {
  return {
    id: row.id,
    draftId: row.draft_id,
    participantId: row.participant_id,
    displayName: row.display_name,
    content: row.content,
    kind: row.kind,
    createdAt: row.created_at,
  };
}

export async function getDraftMessages(
  draftId: string,
  limit = 100
): Promise<DraftMessage[]> {
  await ensureAnonymousUser();

  const { data, error } = await supabase
    .from("draft_messages")
    .select("id,draft_id,participant_id,display_name,content,kind,created_at")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data as MessageRow[]) ?? []).reverse().map(mapMessage);
}

export async function getByeWeeks(seasonYear: number): Promise<Map<string, number>> {
  try {
    const response = await fetch(`/api/nfl/bye-weeks?year=${seasonYear}`);
    if (response.ok) {
      const payload = await response.json() as {
        byeWeeks: Array<{ nfl_team: string; bye_week: number }>;
      };
      if (payload.byeWeeks.length === 32) return buildByeWeekLookup(payload.byeWeeks);
    }
  } catch {
    // Fall back to the locally stored snapshot below when the schedule source
    // or application server is temporarily unavailable.
  }

  const { data, error } = await supabase
    .from("nfl_bye_weeks")
    .select("nfl_team, bye_week")
    .eq("season_year", seasonYear);

  if (error) throw error;

  return buildByeWeekLookup((data ?? []) as Array<{ nfl_team: string; bye_week: number }>);
}

// upsertByeWeeks removed: upsert_bye_weeks RPC is now service_role-only (migration 010).
// If bye-week data ever needs updating from the app, use a server-side route with supabaseAdmin.

export async function assignLandmines(draftId: string): Promise<void> {
  await ensureAnonymousUser();
  const { error } = await supabase.rpc("assign_landmines", { p_draft_id: draftId });
  if (error) throw error;
}

export interface LandminedPlayer {
  playerId: string;
  fullName: string;
  position: string;
  nflTeam: string | null;
}

export async function revealLandmines(draftId: string): Promise<LandminedPlayer[]> {
  await ensureAnonymousUser();
  const { data, error } = await supabase.rpc("reveal_landmines", { p_draft_id: draftId });
  if (error) throw error;
  return ((data as { player_id: string; full_name: string; position: string; nfl_team: string | null }[]) ?? []).map(
    (row) => ({ playerId: row.player_id, fullName: row.full_name, position: row.position, nflTeam: row.nfl_team })
  );
}

export async function sendDraftMessage(
  draftId: string,
  content: string,
  kind: "chat" | "announcement" = "chat"
): Promise<DraftMessage> {
  await ensureAnonymousUser();

  const { data, error } = await supabase.rpc("send_draft_message", {
    p_draft_id: draftId,
    p_content: content,
    p_kind: kind,
  });

  if (error) {
    throw error;
  }

  return mapMessage(getSingleRow<MessageRow>(data, "the sent message"));
}
