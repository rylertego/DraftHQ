import { DraftPick } from "./pick";

export interface DraftState {
  draftId: string;
  currentPick: number;
  picks: DraftPick[];
}
