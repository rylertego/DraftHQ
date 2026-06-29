export const DEFAULT_WALK_UP_SONGS = [
  "/sounds/default-walkup/team_music_default.mp3",
  "/sounds/default-walkup/team_music_default2.mp3",
  "/sounds/default-walkup/team_music_default3.mp3",
  "/sounds/default-walkup/team_music_default4.mp3",
  "/sounds/default-walkup/team_music_default5.mp3",
] as const;

export function getDefaultWalkUpSong(draftPosition: number) {
  const index = Math.max(0, draftPosition - 1) % DEFAULT_WALK_UP_SONGS.length;
  return DEFAULT_WALK_UP_SONGS[index];
}

/**
 * Song choice must be identical in every connected browser. Using the
 * authoritative, one-based pick number also gives a team a different song on
 * later turns without relying on client-local shuffle history.
 */
export function getSynchronizedWalkUpIndex(currentPick: number, songCount: number) {
  if (songCount <= 0) return 0;
  return Math.max(0, currentPick - 1) % songCount;
}

export function getWalkUpPlaybackTiming(
  anchorIso: string,
  serverNowMs: number,
  delayMs = 2_000
) {
  const anchorMs = Date.parse(anchorIso);
  if (!Number.isFinite(anchorMs)) {
    return { delayMs: 0, offsetSeconds: 0 };
  }

  const startsAtMs = anchorMs + delayMs;
  return {
    delayMs: Math.max(0, startsAtMs - serverNowMs),
    offsetSeconds: Math.max(0, (serverNowMs - startsAtMs) / 1_000),
  };
}
