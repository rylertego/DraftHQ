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
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

interface LeagueMemberRow {
  id: string;
  league_id: string;
  user_id: string;
  role: LeagueRole;
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
}

const leagueColumns =
  "id,slug,name,logo_url,banner_url,primary_color,secondary_color,theme,owner_user_id,created_at,updated_at";

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
    .select("id,league_id,user_id,role,joined_at")
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

  const members: LeagueMember[] = memberRows.map((member) => ({
    id: member.id,
    leagueId: member.league_id,
    userId: member.user_id,
    role: member.role,
    displayName: profiles.get(member.user_id)?.display_name ?? "League member",
    avatarUrl: profiles.get(member.user_id)?.avatar_url ?? null,
    joinedAt: member.joined_at,
  }));

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
  }
) {
  await requirePersistentUser();
  const { data, error } = await supabase
    .from("leagues")
    .update({
      name: input.name.trim(),
      logo_url: input.logoUrl.trim() || null,
      banner_url: input.bannerUrl.trim() || null,
      primary_color: input.primaryColor.trim() || null,
      secondary_color: input.secondaryColor.trim() || null,
      theme: input.theme,
    })
    .eq("id", leagueId)
    .select(leagueColumns)
    .single();

  if (error) {
    throw error;
  }

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
      .select("id,name,status,join_code")
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
  const user = await requirePersistentUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Authentication session is missing.");

  const response = await fetch(`/api/leagues/${leagueId}/members`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = (await response.json()) as { error?: string; invited?: boolean };
  if (!response.ok) throw new Error(payload.error ?? "Unable to add member.");
  void user;
  return { invited: payload.invited ?? false };
}

export async function removeLeagueMember(leagueId: string, memberId: string): Promise<void> {
  const user = await requirePersistentUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Authentication session is missing.");

  const response = await fetch(`/api/leagues/${leagueId}/members`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ memberId }),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Unable to remove member.");
  void user;
}

export async function deleteLeague(leagueId: string): Promise<void> {
  await requirePersistentUser();
  const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
  if (error) throw new Error(error.message);
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
