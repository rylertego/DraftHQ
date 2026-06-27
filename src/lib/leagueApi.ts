import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profileApi";
import type { SleeperLeaguePreview } from "@/lib/sleeper";
import type {
  League,
  LeagueMember,
  LeagueRole,
  LeagueSeason,
  LeagueSeasonStatus,
  LeagueSettings,
  LeagueTeam,
  LeagueTheme,
  LeagueWorkspace,
} from "@/types/league";

interface LeagueRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  theme: LeagueTheme;
  team_count: number;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

interface LeagueMemberRow {
  id: string;
  league_id: string;
  user_id: string;
  role: LeagueRole;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  joined_at: string;
}

interface ProfileNameRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface LeagueSeasonRow {
  id: string;
  league_id: string;
  year: number;
  name: string;
  status: LeagueSeasonStatus;
  draft_id: string | null;
}

interface SeasonDraftRow {
  id: string;
  name: string;
  status: "setup" | "active" | "paused" | "complete";
  join_code: string;
  scheduled_at: string | null;
}

const leagueColumns =
  "id,slug,name,logo_url,banner_url,primary_color,secondary_color,theme,team_count,owner_user_id,created_at,updated_at";

function mapLeague(row: LeagueRow): League {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    bannerUrl: row.banner_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    theme: row.theme,
    teamCount: row.team_count ?? 12,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSeason(
  row: LeagueSeasonRow,
  drafts: Map<string, SeasonDraftRow>
): LeagueSeason {
  const draft = row.draft_id ? drafts.get(row.draft_id) : undefined;

  return {
    id: row.id,
    leagueId: row.league_id,
    year: row.year,
    name: row.name,
    status: row.status,
    draftId: row.draft_id,
    draft: draft
      ? {
          id: draft.id,
          name: draft.name,
          status: draft.status,
          joinCode: draft.join_code,
          scheduledAt: draft.scheduled_at ?? null,
        }
      : null,
  };
}

async function requirePersistentUser() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user || data.user.is_anonymous) {
    throw new Error("Sign in with a persistent account to manage leagues.");
  }

  return data.user;
}

// Returns a fresh access token after verifying the session is valid and non-anonymous.
// getUser() triggers a token refresh if needed; getSession() is called after to get the
// post-refresh token so we never send a stale JWT to the API route.
async function requireAuthToken(): Promise<{ user: Awaited<ReturnType<typeof requirePersistentUser>>; accessToken: string }> {
  const user = await requirePersistentUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Authentication session is missing.");
  return { user, accessToken };
}

export interface LeagueBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export async function getLeagueBranding(slug: string): Promise<LeagueBranding | null> {
  const { data, error } = await supabase
    .from("leagues")
    .select("name,logo_url,primary_color,secondary_color")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return {
    name: (data as { name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null }).name,
    logoUrl: (data as { name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null }).logo_url,
    primaryColor: (data as { name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null }).primary_color,
    secondaryColor: (data as { name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null }).secondary_color,
  };
}

export async function createLeague(input: { name: string; slug: string }) {
  await requirePersistentUser();
  const { data, error } = await supabase.rpc("create_league", {
    p_name: input.name.trim(),
    p_slug: input.slug.trim().toLowerCase(),
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Supabase did not return the created league.");
  }

  return mapLeague(row as LeagueRow);
}

export async function getMyLeagues() {
  await requirePersistentUser();
  const { data, error } = await supabase
    .from("leagues")
    .select(leagueColumns)
    .order("name");

  if (error) {
    throw error;
  }

  return (data as LeagueRow[]).map(mapLeague);
}

export async function getMyCommissionerLeagues() {
  const user = await requirePersistentUser();
  const leagues = await getMyLeagues();
  const { data, error } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id)
    .eq("role", "commissioner");

  if (error) {
    throw error;
  }

  const commissionerLeagueIds = new Set(
    (data as Array<{ league_id: string }>).map((member) => member.league_id)
  );

  return leagues.filter(
    (league) =>
      league.ownerUserId === user.id || commissionerLeagueIds.has(league.id)
  );
}

export async function getLeagueSettings(slug: string): Promise<LeagueSettings> {
  const user = await requirePersistentUser();
  const { data: leagueData, error: leagueError } = await supabase
    .from("leagues")
    .select(leagueColumns)
    .eq("slug", slug)
    .single();

  if (leagueError) {
    throw leagueError;
  }

  const league = mapLeague(leagueData as LeagueRow);
  const { data: memberData, error: memberError } = await supabase
    .from("league_members")
    .select("id,league_id,user_id,role,nickname,avatar_url,bio,joined_at")
    .eq("league_id", league.id)
    .order("joined_at");

  if (memberError) {
    throw memberError;
  }

  const memberRows = memberData as LeagueMemberRow[];
  const userIds = memberRows.map((member) => member.user_id);
  let profiles = new Map<string, ProfileNameRow>();

  if (userIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    profiles = new Map(
      (profileData as ProfileNameRow[]).map((profile) => [profile.id, profile])
    );
  }

  const members: LeagueMember[] = memberRows.map((member) => {
    const profile = profiles.get(member.user_id);
    return {
      id: member.id,
      leagueId: member.league_id,
      userId: member.user_id,
      role: member.role,
      displayName: member.nickname ?? profile?.display_name ?? "League member",
      avatarUrl: member.avatar_url ?? profile?.avatar_url ?? null,
      nickname: member.nickname,
      bio: member.bio,
      joinedAt: member.joined_at,
    };
  });

  return {
    league,
    members,
    canManage:
      league.ownerUserId === user.id ||
      members.some(
        (member) =>
          member.userId === user.id && member.role === "commissioner"
      ),
  };
}

export async function updateLeagueSettings(
  leagueId: string,
  input: {
    name: string;
    logoUrl: string;
    bannerUrl: string;
    primaryColor: string;
    secondaryColor: string;
    theme: LeagueTheme;
    teamCount?: number;
  }
) {
  await requirePersistentUser();
  const { data, error } = await supabase.rpc("update_league_settings", {
    p_league_id:       leagueId,
    p_name:            input.name.trim(),
    p_logo_url:        input.logoUrl.trim(),
    p_banner_url:      input.bannerUrl.trim(),
    p_primary_color:   input.primaryColor.trim(),
    p_secondary_color: input.secondaryColor.trim(),
    p_theme:           input.theme,
    p_team_count:      input.teamCount ?? null,
  });

  if (error) throw error;

  return mapLeague(data as LeagueRow);
}

export async function getLeagueWorkspace(
  slug: string
): Promise<LeagueWorkspace> {
  const settings = await getLeagueSettings(slug);
  const { data: seasonData, error: seasonError } = await supabase
    .from("league_seasons")
    .select("id,league_id,year,name,status,draft_id")
    .eq("league_id", settings.league.id)
    .order("year", { ascending: false });

  if (seasonError) {
    throw seasonError;
  }

  const seasonRows = seasonData as LeagueSeasonRow[];
  const draftIds = seasonRows.flatMap((season) =>
    season.draft_id ? [season.draft_id] : []
  );
  const drafts = new Map<string, SeasonDraftRow>();

  if (draftIds.length > 0) {
    const { data: draftData, error: draftError } = await supabase
      .from("drafts")
      .select("id,name,status,join_code,scheduled_at")
      .in("id", draftIds);

    if (draftError) {
      throw draftError;
    }

    for (const draft of draftData as SeasonDraftRow[]) {
      drafts.set(draft.id, draft);
    }
  }

  return {
    ...settings,
    seasons: seasonRows.map((season) => mapSeason(season, drafts)),
  };
}

export async function getMyLeagueWorkspaces() {
  const leagues = await getMyLeagues();
  return Promise.all(
    leagues.map((league) => getLeagueWorkspace(league.slug))
  );
}

function getSingleSeason(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("Supabase did not return the created season.");
  }

  return mapSeason(row as LeagueSeasonRow, new Map());
}

export async function inviteLeagueMember(leagueId: string, email: string): Promise<{ invited: boolean }> {
  const { accessToken } = await requireAuthToken();

  const response = await fetch(`/api/leagues/${leagueId}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = (await response.json()) as { error?: string; invited?: boolean };
  if (!response.ok) throw new Error(payload.error ?? "Unable to add member.");
  return { invited: payload.invited ?? false };
}

export async function removeLeagueMember(leagueId: string, memberId: string): Promise<void> {
  const { accessToken } = await requireAuthToken();

  const response = await fetch(`/api/leagues/${leagueId}/members`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ memberId }),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Unable to remove member.");
}

export async function updateLeagueMemberProfile(
  leagueId: string,
  input: { nickname: string; avatarUrl: string; bio: string }
): Promise<void> {
  await requirePersistentUser();
  const { error } = await supabase.rpc("update_league_member_profile", {
    p_league_id: leagueId,
    p_nickname: input.nickname,
    p_avatar_url: input.avatarUrl,
    p_bio: input.bio,
  });
  if (error) throw new Error(error.message);
}

export async function uploadLeagueMemberAvatar(leagueId: string, file: File): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user || userData.user.is_anonymous) {
    throw new Error("Sign in to upload an avatar.");
  }
  const userId = userData.user.id;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `leagues/${leagueId}/${userId}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function deleteLeague(leagueId: string): Promise<void> {
  await requirePersistentUser();
  const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
  if (error) throw new Error(error.message);
}

export async function createDraftForSeason(input: {
  seasonId: string;
  draftName: string;
  teamCount: number;
  rounds: number;
}) {
  const { profile } = await getMyProfile();
  const { data, error } = await supabase.rpc("create_draft_for_season", {
    p_season_id: input.seasonId,
    p_name: input.draftName.trim(),
    p_team_count: input.teamCount,
    p_rounds: input.rounds,
    p_display_name: profile.displayName,
  });

  if (error) throw error;
  return getSingleSeason(data);
}

export async function resetSeasonDraft(seasonId: string) {
  const { error } = await supabase.rpc("reset_season_draft", {
    p_season_id: seasonId,
  });
  if (error) throw error;
}

export async function createLeagueSeasonDraft(input: {
  leagueId: string;
  year: number;
  seasonName: string;
  draftName: string;
  teamCount: number;
  rounds: number;
}) {
  const { profile } = await getMyProfile();
  const { data, error } = await supabase.rpc("create_league_season_draft", {
    p_league_id: input.leagueId,
    p_year: input.year,
    p_season_name: input.seasonName.trim(),
    p_draft_name: input.draftName.trim(),
    p_team_count: input.teamCount,
    p_rounds: input.rounds,
    p_display_name: profile.displayName,
  });

  if (error) {
    throw error;
  }

  return getSingleSeason(data);
}

export async function createImportedLeagueSeason(input: {
  leagueId: string;
  year: number;
  seasonName: string;
  draftName: string;
  rounds: number;
  teamNames: string[];
}) {
  const { profile } = await getMyProfile();
  const { data, error } = await supabase.rpc("create_imported_league_season", {
    p_league_id: input.leagueId,
    p_year: input.year,
    p_season_name: input.seasonName.trim(),
    p_draft_name: input.draftName.trim(),
    p_rounds: input.rounds,
    p_display_name: profile.displayName,
    p_team_names: input.teamNames,
  });

  if (error) {
    throw error;
  }

  return getSingleSeason(data);
}

export async function createSleeperLeagueSeason(input: {
  leagueId: string;
  year: number;
  seasonName: string;
  draftName: string;
  rounds: number;
  preview: SleeperLeaguePreview;
}) {
  const { profile } = await getMyProfile();
  const { data, error } = await supabase.rpc("create_sleeper_league_season", {
    p_league_id: input.leagueId,
    p_year: input.year,
    p_season_name: input.seasonName.trim(),
    p_draft_name: input.draftName.trim(),
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

  return getSingleSeason(data);
}

// --- League Teams ---

interface LeagueTeamRow {
  id: string;
  league_id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  archived_at: string | null;
  last_season_pick: number | null;
  last_season_record: string | null;
  last_season_playoffs: boolean | null;
  created_at: string;
}

const LEAGUE_TEAM_COLUMNS =
  "id,league_id,name,short_name,logo_url,owner_user_id,owner_name,archived_at,last_season_pick,last_season_record,last_season_playoffs,created_at";

function mapLeagueTeamRow(
  row: LeagueTeamRow,
  profileMap: Map<string, { displayName: string; avatarUrl: string | null }>,
  historyIds: Set<string>
): LeagueTeam {
  const profile = row.owner_user_id ? profileMap.get(row.owner_user_id) : undefined;
  return {
    id: row.id,
    leagueId: row.league_id,
    name: row.name,
    shortName: row.short_name,
    logoUrl: row.logo_url,
    ownerUserId: row.owner_user_id,
    ownerDisplayName: profile?.displayName ?? null,
    ownerAvatarUrl: profile?.avatarUrl ?? null,
    ownerName: row.owner_name,
    archivedAt: row.archived_at,
    hasSeasonHistory: historyIds.has(row.id),
    lastSeasonPick: row.last_season_pick,
    lastSeasonRecord: row.last_season_record,
    lastSeasonPlayoffs: row.last_season_playoffs,
    createdAt: row.created_at,
  };
}

export async function getLeagueTeams(leagueId: string): Promise<LeagueTeam[]> {
  const { data: teamRows, error } = await supabase
    .from("league_teams")
    .select(LEAGUE_TEAM_COLUMNS)
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!teamRows || teamRows.length === 0) return [];

  const rows = teamRows as LeagueTeamRow[];
  const teamIds = rows.map((r) => r.id);
  const ownerIds = [...new Set(rows.map((r) => r.owner_user_id).filter(Boolean) as string[])];

  // Fetch which teams appear in any season (FK would block deletion of these)
  const historyIds = new Set<string>();
  const { data: seasonRefs } = await supabase
    .from("league_team_seasons")
    .select("league_team_id")
    .in("league_team_id", teamIds);
  if (seasonRefs) {
    for (const r of seasonRefs as { league_team_id: string }[]) {
      historyIds.add(r.league_team_id);
    }
  }

  const profileMap = new Map<string, { displayName: string; avatarUrl: string | null }>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url")
      .in("id", ownerIds);
    if (profiles) {
      for (const p of profiles as { id: string; display_name: string; avatar_url: string | null }[]) {
        profileMap.set(p.id, { displayName: p.display_name, avatarUrl: p.avatar_url });
      }
    }
  }

  return rows.map((row) => mapLeagueTeamRow(row, profileMap, historyIds));
}

export interface CreateLeagueTeamData {
  name: string;
  shortName?: string;
  ownerUserId?: string | null;
  ownerName?: string;
  lastSeasonPick?: number | null;
  lastSeasonRecord?: string;
  lastSeasonPlayoffs?: boolean | null;
}

export async function createLeagueTeam(leagueId: string, data: CreateLeagueTeamData): Promise<LeagueTeam> {
  const { data: row, error } = await supabase
    .from("league_teams")
    .insert({
      league_id: leagueId,
      name: data.name.trim(),
      short_name: data.shortName?.trim() || null,
      owner_user_id: data.ownerUserId ?? null,
      owner_name: data.ownerName?.trim() || null,
      last_season_pick: data.lastSeasonPick ?? null,
      last_season_record: data.lastSeasonRecord?.trim() || null,
      last_season_playoffs: data.lastSeasonPlayoffs ?? null,
    })
    .select(LEAGUE_TEAM_COLUMNS)
    .single();

  if (error) throw error;
  return mapLeagueTeamRow(row as LeagueTeamRow, new Map(), new Set());
}

export interface UpdateLeagueTeamDetailsData {
  name?: string;
  shortName?: string | null;
  ownerName?: string | null;
  logoUrl?: string | null;
}

export async function updateLeagueTeamDetails(leagueId: string, teamId: string, data: UpdateLeagueTeamDetailsData): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.shortName !== undefined) patch.short_name = data.shortName?.trim() || null;
  if (data.ownerName !== undefined) patch.owner_name = data.ownerName?.trim() || null;
  if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;

  const { error } = await supabase
    .from("league_teams")
    .update(patch)
    .eq("id", teamId)
    .eq("league_id", leagueId);

  if (error) throw error;
}

export async function uploadLeagueTeamLogo(leagueId: string, teamId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${leagueId}/${teamId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("league-team-logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("league-team-logos").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("league_teams")
    .update({ logo_url: url })
    .eq("id", teamId)
    .eq("league_id", leagueId);

  if (updateError) throw updateError;
  return url;
}

export async function archiveLeagueTeam(leagueId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from("league_teams")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", teamId)
    .eq("league_id", leagueId);

  if (error) throw error;
}

export async function unarchiveLeagueTeam(leagueId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from("league_teams")
    .update({ archived_at: null })
    .eq("id", teamId)
    .eq("league_id", leagueId);

  if (error) throw error;
}

export async function updateLeagueTeamName(leagueId: string, teamId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("league_teams")
    .update({ name: name.trim() })
    .eq("id", teamId)
    .eq("league_id", leagueId);

  if (error) throw error;
}

export async function deleteLeagueTeam(leagueId: string, teamId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_league_team", {
    p_league_id: leagueId,
    p_league_team_id: teamId,
  });

  if (error) throw error;
}

export async function assignLeagueTeamOwner(
  leagueId: string,
  teamId: string,
  userId: string | null
): Promise<void> {
  const { error } = await supabase.rpc("assign_league_team_owner", {
    p_league_id: leagueId,
    p_league_team_id: teamId,
    p_user_id: userId,
  });

  if (error) throw error;
}
