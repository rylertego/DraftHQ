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

/**
 * FNV-1a. Small, dependency-free, and — the property that matters here —
 * identical in every browser, unlike anything seeded from Math.random().
 */
function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Mulberry32: a seeded PRNG, so the same seed replays the same sequence. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A team's walk-up songs in shuffled order, as a list of indices into their
 * song list.
 *
 * Seeded on team + draft + cycle so it is derived, never stored: every client
 * computes the identical permutation with nothing broadcast, which is the same
 * guarantee getSynchronizedWalkUpIndex provides via modulo. The draft id
 * reshuffles each new draft; the cycle reshuffles each time the owner works
 * through their whole list, so a long draft does not replay one fixed order.
 */
function shuffleForCycle(teamId: string, draftId: string, songCount: number, cycle: number) {
  const order = Array.from({ length: songCount }, (_, i) => i);
  const random = seededRandom(hashSeed(`${teamId}:${draftId}:${cycle}`));
  // Fisher-Yates, walked back to front.
  for (let i = songCount - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function getShuffledWalkUpOrder(
  teamId: string,
  draftId: string,
  songCount: number,
  cycle = 0
): number[] {
  if (songCount <= 0) return [];

  // Built forward from the first cycle because each cycle's guard depends on
  // what the previous one ended on. Cycle count is bounded by rounds ÷ songs,
  // so this stays trivial.
  let order = shuffleForCycle(teamId, draftId, songCount, 0);
  for (let c = 1; c <= Math.max(0, cycle); c += 1) {
    const previousLast = order[order.length - 1];
    const next = shuffleForCycle(teamId, draftId, songCount, c);
    // A fresh permutation may open on the song the last one closed with,
    // which would play it twice in a row across the boundary. Swapping the
    // first two entries fixes that deterministically. With one song the
    // repeat is unavoidable, so leave it alone.
    if (songCount > 1 && next[0] === previousLast) {
      [next[0], next[1]] = [next[1], next[0]];
    }
    order = next;
  }
  return order;
}

/**
 * Which song this team plays on a given turn of theirs.
 *
 * Indexed by the team's own turn number rather than the draft's overall pick
 * number, so an owner's first turn plays the first song of their order and
 * each later turn advances by one — no repeats until the list wraps.
 */
export function getShuffledWalkUpIndex(
  teamId: string,
  draftId: string,
  turnNumber: number,
  songCount: number
): number {
  if (songCount <= 0) return 0;
  const turn = Math.max(0, turnNumber);
  const cycle = Math.floor(turn / songCount);
  const order = getShuffledWalkUpOrder(teamId, draftId, songCount, cycle);
  return order[turn % songCount];
}

/**
 * How many turns this team has already completed, derived from the pick list
 * so every client agrees and an undone pick self-corrects.
 */
export function getTeamTurnNumber(
  picks: Array<{ teamId: string }>,
  teamId: string
): number {
  return picks.reduce((count, pick) => (pick.teamId === teamId ? count + 1 : count), 0);
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

export function getEffectiveWalkUpVolume({
  musicVolume,
  tvMode,
  tvMasterVolume,
  tvMuted,
}: {
  musicVolume: number;
  tvMode: boolean;
  tvMasterVolume: number;
  tvMuted: boolean;
}) {
  const base = Math.max(0, Math.min(100, musicVolume));
  if (!tvMode) return base;
  if (tvMuted) return 0;
  const tv = Math.max(0, Math.min(100, tvMasterVolume));
  return Math.round(base * (tv / 100));
}

export type PlaybackRoute = "spotify-sdk" | "youtube" | "preview" | "unavailable";

/** Which mechanism can actually play this song right now.
 *
 *  "unavailable" is the case that used to disappear: a Spotify track with no
 *  YouTube match and no preview clip, on a page whose Spotify device is not
 *  ready. Spotify stopped returning preview_url for newer apps, and the
 *  YouTube match is only stored when YOUTUBE_DATA_API_KEY is configured, so
 *  this is the common state — not an edge case. Callers must report it rather
 *  than fall through to silence. */
export function resolvePlaybackRoute(
  song: { platform: "youtube" | "spotify"; youtubeTrackId?: string | null; previewUrl?: string | null },
  spotifyDeviceReady: boolean
): PlaybackRoute {
  if (song.platform === "youtube") return "youtube";
  if (spotifyDeviceReady) return "spotify-sdk";
  if (song.youtubeTrackId) return "youtube";
  if (song.previewUrl) return "preview";
  return "unavailable";
}
