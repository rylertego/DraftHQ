import { DraftState } from "@/types/draftState";

const STORAGE_KEY_PREFIX = "draftState:";

export function saveDraftState(state: DraftState) {
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${state.draftId}`,
    JSON.stringify(state)
  );
}

export function getDraftState(draftId: string): DraftState | null {
  const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${draftId}`);

  if (!data) {
    return null;
  }

  const state = JSON.parse(data) as DraftState;

  return state.draftId === draftId ? state : null;
}
