import { DraftState } from "@/types/draftState";

const STORAGE_KEY = "draftState";

export function saveDraftState(state: DraftState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}

export function getDraftState(): DraftState | null {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return null;
  }

  return JSON.parse(data);
}