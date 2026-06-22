import { supabase } from "@/lib/supabase";
import type {
  League,
  LeagueMember,
  LeagueRole,
  LeagueSettings,
  LeagueTheme,
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
  let profileNames = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    profileNames = new Map(
      (profileData as ProfileNameRow[]).map((profile) => [
        profile.id,
        profile.display_name,
      ])
    );
  }

  const members: LeagueMember[] = memberRows.map((member) => ({
    id: member.id,
    leagueId: member.league_id,
    userId: member.user_id,
    role: member.role,
    displayName: profileNames.get(member.user_id) ?? "League member",
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
