export type DraftStatus = "setup" | "active" | "paused" | "complete";

export type DraftRole = "commissioner" | "owner" | "viewer";

export type PlayerPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "FLEX" | "UNKNOWN";

export interface Draft {
  id: string;
  name: string;
  teamCount: number;
  rounds: number;
  currentPick: number;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  draftId: string;
  name: string;
  draftPosition: number;
  logoUrl?: string;
}

export interface Pick {
  id: string;
  draftId: string;
  teamId: string;
  round: number;
  pickNumber: number;
  overallPickNumber: number;
  playerName: string;
  playerPosition: PlayerPosition;
  nflTeam?: string;
  createdAt: string;
}

export interface DraftSlot {
  round: number;
  pickNumber: number;
  overallPickNumber: number;
  teamId: string;
  teamName: string;
  pick?: Pick;
}
