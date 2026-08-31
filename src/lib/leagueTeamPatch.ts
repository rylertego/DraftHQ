import type { WalkUpSong } from "@/types/draft";

export interface UpdateLeagueTeamDetailsData {
  name?: string;
  shortName?: string | null;
  ownerName?: string | null;
  logoUrl?: string | null;
  ownerPhotoUrl?: string | null;
  walkUpSongs?: WalkUpSong[];
  ttsName?: string | null;
}

/** Partial patch: an absent key means "leave this column alone", which is why
 *  the commissioner path can edit one field without echoing back the rest. */
export function buildLeagueTeamPatch(data: UpdateLeagueTeamDetailsData): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.shortName !== undefined) patch.short_name = data.shortName?.trim() || null;
  if (data.ownerName !== undefined) patch.owner_name = data.ownerName?.trim() || null;
  if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;
  if (data.ownerPhotoUrl !== undefined) patch.owner_photo_url = data.ownerPhotoUrl;
  if (data.walkUpSongs !== undefined) patch.walk_up_songs = data.walkUpSongs;
  if (data.ttsName !== undefined) patch.tts_name = data.ttsName?.trim() || null;
  return patch;
}
