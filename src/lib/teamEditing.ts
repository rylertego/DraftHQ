export interface TeamProfileFields {
  name: string;
  shortName: string;
  ownerName: string;
  ttsName: string;
}

/** Which team the editor opens on: an explicit link target, else the viewer's
 *  own team, else the first team — a commissioner does not necessarily own one. */
export function resolveInitialTeamId(
  teamIdParam: string | null,
  myTeamId: string | null,
  teamIds: string[]
): string | null {
  if (teamIdParam && teamIds.includes(teamIdParam)) return teamIdParam;
  if (myTeamId && teamIds.includes(myTeamId)) return myTeamId;
  return teamIds[0] ?? null;
}

/** Walk-up songs are deliberately absent: they persist on add and remove, so
 *  they are never pending when a switch happens. */
export function isTeamProfileDirty(
  form: TeamProfileFields,
  team: TeamProfileFields,
  hasPendingUpload: boolean
): boolean {
  if (hasPendingUpload) return true;
  const keys: Array<keyof TeamProfileFields> = ["name", "shortName", "ownerName", "ttsName"];
  return keys.some((key) => form[key].trim() !== team[key].trim());
}

/** Managers edit any team from this entry, so "My Team" would understate it. */
export function teamNavLabel(canManage: boolean): string {
  return canManage ? "Teams" : "My Team";
}
