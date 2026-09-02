/**
 * Player headshots are Cloudinary URLs on static.www.nfl.com, stored without a
 * width. Unconstrained, one is ~727 KB of WebP for a slot that renders at most
 * 224 CSS px — and the reveal preloader warms dozens of them, so the untouched
 * URLs cost tens of megabytes per draft room. Asking Cloudinary for the display
 * width instead drops a headshot to ~13 KB.
 *
 * The preloaded URL and the rendered `src` must match exactly or the warm cache
 * is wasted, so both sides go through this function with the same width.
 */

const NFL_UPLOAD = /^(https:\/\/static\.www\.nfl\.com\/image\/upload\/)([^/]+)(\/.*)$/;

/** A Cloudinary transform segment is comma-separated `key_value` pairs. Without
 *  this check a URL that has no transforms would have its first path segment
 *  mistaken for one and rewritten away. */
const TRANSFORM_SEGMENT = /^[a-z]+_[^/]*(,[a-z]+_[^/]*)*$/;

export function sizedHeadshot<T extends string | undefined>(url: T, width: number): T {
  if (!url) return url;

  const match = NFL_UPLOAD.exec(url);
  if (!match) return url;

  const [, prefix, segment, rest] = match;

  if (!TRANSFORM_SEGMENT.test(segment)) {
    return `${prefix}w_${width}/${segment}${rest}` as T;
  }

  // Drop any width we set earlier so repeated calls stay idempotent.
  const transforms = segment
    .split(",")
    .filter((part) => part && !part.startsWith("w_"));

  return `${prefix}${[...transforms, `w_${width}`].join(",")}${rest}` as T;
}

/** Reveal card slot renders at 224 CSS px; 400 covers it at 2x DPR. */
export const HEADSHOT_REVEAL_WIDTH = 400;

/** TV-mode last-pick avatar renders at 48 CSS px. */
export const HEADSHOT_AVATAR_WIDTH = 96;

/** Defenses are the one drafted "player" with no headshot, so they used to fall
 *  through to the blank silhouette. The club's own logo is what every other
 *  fantasy platform shows, and it is a vector — sharp at any size, and smaller
 *  than the photo it stands in for. */
function clubLogoUrl(nflTeam: string): string {
  return `https://static.www.nfl.com/league/api/clubs/logos/${nflTeam.trim().toUpperCase()}.svg`;
}

export interface PlayerImage {
  url: string;
  /** Photos are framed on the face (`object-cover object-top`); a logo cropped
   *  that way loses half the mark, so callers switch to a contained fit. */
  isTeamLogo: boolean;
}

export function playerImage(
  player: { position?: string; nflTeam?: string; headshotUrl?: string } | undefined,
  width: number
): PlayerImage | undefined {
  if (!player) return undefined;

  if (player.headshotUrl) {
    return { url: sizedHeadshot(player.headshotUrl, width), isTeamLogo: false };
  }

  if (player.position?.toUpperCase() === "DST" && player.nflTeam?.trim()) {
    return { url: clubLogoUrl(player.nflTeam), isTeamLogo: true };
  }

  return undefined;
}
