import { DraftPick } from "./pick";

export interface DraftState {
  draftName: string;
  teamCount: number;
  rounds: number;
  teams: string[];
  currentPick: number;
  picks: DraftPick[];
}