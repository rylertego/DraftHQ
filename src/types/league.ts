import type { WalkUpSong } from "@/types/draft";

export type LeagueRole = "commissioner" | "co-commissioner" | "member";
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
  sleeperLeagueId: string | null;
  sleeperLastSyncedAt: string | null;
  activeIntegration: "sleeper" | "espn" | "yahoo" | null;
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
  teamCount: number;
  rounds: number;
  pickSeconds: number;
  timerBehavior: "nothing" | "skip" | "auto_draft";
}

export interface LeagueSeason {
  id: string;
  leagueId: string;
  year: number;
  name: string;
  status: LeagueSeasonStatus;
  draftId: string | null;
  draft: LeagueSeasonDraft | null;
  sleeperLeagueId: string | null;
  championTeamId: string | null;
  sleeperSyncedAt: string | null;
  standings: LeagueSeasonStanding[];
}

export interface LeagueSeasonStanding {
  leagueTeamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  sleeperRosterId: number;
  finalRank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  playoffFinish: number | null;
}

export interface LeagueTeam {
  id: string;
  leagueId: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  ownerPhotoUrl: string | null;
  ownerUserId: string | null;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  ownerName: string | null;
  archivedAt: string | null;
  hasSeasonHistory: boolean;
  lastSeasonPick: number | null;
  lastSeasonRecord: string | null;
  lastSeasonPlayoffs: boolean | null;
  lastSeasonPickPlayer: string | null;
  walkUpSongs: WalkUpSong[];
  // Moved off the draft team: the league team is the one place this is edited,
  // and a trigger syncs it down into each linked draft team. Autodraft and
  // pre-draft notes deliberately did NOT move — they are decisions about one
  // draft night, so they stay on the draft team.
  ttsName: string | null;
  createdAt: string;
}

export interface LeagueWorkspace {
  league: League;
  members: LeagueMember[];
  seasons: LeagueSeason[];
  canManage: boolean;
  myTeam: { id: string; name: string; logoUrl: string | null } | null;
}

export interface LeagueSettings {
  league: League;
  members: LeagueMember[];
  canManage: boolean;
}
