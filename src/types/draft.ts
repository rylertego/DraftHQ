export type DraftStatus = "setup" | "active" | "paused" | "complete";

export type DraftRole = "commissioner" | "owner" | "viewer";

export type PlayerPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "FLEX" | "UNKNOWN";

export interface Draft {
  id: string;
  name: string;
  joinCode: string;
  commissionerUserId: string;
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

export interface Player {
  id: string;
  source: string;
  externalId?: string;
  fullName: string;
  position: PlayerPosition;
  nflTeam?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pick {
  id: string;
  draftId: string;
  teamId: string;
  playerId: string;
  participantId?: string;
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

export interface DraftParticipant {
  id: string;
  draftId: string;
  userId: string;
  teamId: string | null;
  displayName: string;
  role: DraftRole;
  createdAt: string;
  updatedAt: string;
}

export interface DraftInvitation {
  id: string;
  draftId: string;
  email: string;
  teamId: string | null;
  status: "pending" | "accepted";
  participantId: string | null;
  invitedAt: string;
  acceptedAt: string | null;
}
