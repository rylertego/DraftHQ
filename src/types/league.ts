export type LeagueRole = "commissioner" | "member";
export type LeagueTheme = "classic" | "broadcast" | "dark" | "modern";
export type LeagueSeasonStatus =
  | "upcoming"
  | "drafting"
  | "active"
  | "complete";

export interface League {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  theme: LeagueTheme;
  teamCount: number;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueMember {
  id: string;
  leagueId: string;
  userId: string;
  role: LeagueRole;
  displayName: string;
  avatarUrl: string | null;
  nickname: string | null;
  bio: string | null;
  joinedAt: string;
}

export interface LeagueSeasonDraft {
  id: string;
  name: string;
  status: "setup" | "active" | "paused" | "complete";
  joinCode: string;
  scheduledAt: string | null;
}

export interface LeagueSeason {
  id: string;
  leagueId: string;
  year: number;
  name: string;
  status: LeagueSeasonStatus;
  draftId: string | null;
  draft: LeagueSeasonDraft | null;
}

export interface LeagueTeam {
  id: string;
  leagueId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  ownerName: string | null;
  archivedAt: string | null;
  hasSeasonHistory: boolean;
  lastSeasonPick: number | null;
  lastSeasonRecord: string | null;
  lastSeasonPlayoffs: boolean | null;
  createdAt: string;
}

export interface LeagueWorkspace {
  league: League;
  members: LeagueMember[];
  seasons: LeagueSeason[];
  canManage: boolean;
}

export interface LeagueSettings {
  league: League;
  members: LeagueMember[];
  canManage: boolean;
}
