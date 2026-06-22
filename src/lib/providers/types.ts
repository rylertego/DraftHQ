export interface ProviderTeamPreview {
  externalId: string;
  ownerName: string;
  teamName: string;
  draftPosition: number;
}

export interface ProviderLeaguePreview {
  leagueName: string;
  rounds: number;
  teams: ProviderTeamPreview[];
  warnings: string[];
}
