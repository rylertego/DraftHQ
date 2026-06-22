export type LeagueRole = "commissioner" | "member";
export type LeagueTheme = "classic" | "broadcast" | "dark" | "modern";

export interface League {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  theme: LeagueTheme;
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
  joinedAt: string;
}

export interface LeagueSettings {
  league: League;
  members: LeagueMember[];
  canManage: boolean;
}
