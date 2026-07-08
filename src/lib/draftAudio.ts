// Max walk-up songs per team. Not a technical limit (storage is JSONB and the
// player is count-agnostic) — just keeps the team card UI sane. Ten covers a
// full draft night of variety.
export const MAX_WALK_UP_SONGS = 10;

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

export type WalkUpMusicMode = "restart" | "resume";

/**
 * Cumulative seconds of walk-up music a team has "listened to" across its
 * completed turns, derived entirely from pick timestamps so every client
 * computes the same value with no stored audio state.
 *
 * A team's turn for its pick at overall number N runs from
 * createdAt(pick N-1) + graceMs (music starts after the grace delay) to
 * createdAt(pick N). The draft's very first pick has no preceding pick and
 * its anchor cannot be reconstructed later, so it contributes 0.
 *
 * Known imprecision (accepted): wall-clock elapsed includes time the music
 * was actually suppressed (pick reveals, pauses), so the derived position
 * runs slightly ahead of what was heard. For music this is inaudible.
 */
export function getTeamCumulativeListenSeconds(
  picks: Array<{ teamId: string; overallPickNumber: number; createdAt: string }>,
  teamId: string,
  graceMs = 2_000
): number {
  if (picks.length === 0) return 0;
  const byOverall = new Map<number, string>();
  for (const pick of picks) byOverall.set(pick.overallPickNumber, pick.createdAt);
  let totalSeconds = 0;
  for (const pick of picks) {
    if (pick.teamId !== teamId) continue;
    const prevCreatedAt = byOverall.get(pick.overallPickNumber - 1);
    if (!prevCreatedAt) continue;
    const start = Date.parse(prevCreatedAt) + graceMs;
    const end = Date.parse(pick.createdAt);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      totalSeconds += (end - start) / 1_000;
    }
  }
  return totalSeconds;
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
