export type DraftStatus = "setup" | "active" | "paused" | "complete";

export interface RosterPosition {
  id: string;
  label: string;
  abbrev: string;
  enabled: boolean;
  min: number;
  max: number;
  color: string;
}

export type DraftRole = "commissioner" | "owner" | "viewer";

export type TimerBehavior = "nothing" | "skip" | "auto_draft";

export type PlayerPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "FLEX" | "UNKNOWN";

export interface Draft {
  id: string;
  name: string;
  joinCode: string;
  commissionerUserId: string;
  leagueId: string | null;
  teamCount: number;
  rounds: number;
  currentPick: number;
  status: DraftStatus;
  pickSeconds: number;
  pickDeadlineAt: string | null;
  pausedRemainingSeconds: number | null;
  timerBehavior: TimerBehavior;
  clockExtensionSeconds: number;
  maxClockExtensions: number;
  clockExtensionsUsed: number;
  sleeperLeagueId: string | null;
  sleeperDraftId: string | null;
  scheduledAt: string | null;
  scheduledTimezone: string | null;
  rosterPositions: RosterPosition[] | null;
  scoringType: "standard" | "ppr" | "half_ppr" | "superflex";
  useLandmines: boolean;
  landmineCount: number;
  hidePlayerRankings: boolean;
  sfx1Url: string | null;
  sfx2Url: string | null;
  posReactions: string[] | null;
  negReactions: string[] | null;
  pickIsInEnabled: boolean;
  pickIsInSfxUrl: string | null;
  draftStartAudioUrl: string | null;
  showRoundSlide: boolean;
  roundSlideSeconds: number;
  roundSlidePausesClock: boolean;
  announcerVoiceUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  draftId: string;
  name: string;
  draftPosition: number;
  logoUrl?: string;
  sleeperRosterId?: number;
  sleeperOwnerUserId?: string;
  shortName?: string;
  ttsName?: string;
  autodraft?: boolean;
  preDraftNotes?: string;
  lastSeasonPick?: number;
  lastSeasonRecord?: string;
  lastSeasonPlayoffs?: boolean;
  ownerName?: string;
  ownerPhotoUrl?: string;
  clockExtensionsUsed?: number;
  lastSeasonPickPlayer?: string;
  walkUpSongs?: WalkUpSong[];
}

export interface WalkUpSong {
  platform: "youtube" | "spotify";
  trackId: string;
  url: string;
  title: string;
  artist?: string;
  thumbnail?: string;
  startSeconds?: number;
  previewUrl?: string | null;
  youtubeTrackId?: string | null; // YouTube fallback for Spotify songs
}

export interface Player {
  id: string;
  source: string;
  externalId?: string;
  fullName: string;
  position: PlayerPosition;
  nflTeam?: string;
  rank?: number;
  headshotUrl?: string;
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
  isLandmine: boolean;
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

export type MessageKind = "chat" | "announcement" | "system";

export interface DraftMessage {
  id: string;
  draftId: string;
  participantId: string | null;
  displayName: string;
  content: string;
  kind: MessageKind;
  createdAt: string;
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
