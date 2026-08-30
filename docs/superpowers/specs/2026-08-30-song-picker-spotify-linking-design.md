# Song Picker: Accent Polish, Persistent Hint, and Inline Spotify Linking

Date: 2026-08-30
Status: Approved, ready for planning

## Problem

Three issues surfaced while adding walk-up songs on My Team:

1. The close button in the Add a Walk-Up Song modal is hardcoded `text-slate-400`.
   Every other interactive element in that modal already uses the league accent
   color, so the X looks unthemed.

2. The YouTube instruction ("Find the song on YouTube, copy the link, and paste
   it above") lives in the empty-results area. It disappears the moment the user
   types — precisely when a malformed link needs explaining.

3. The Spotify tab only exists when the user is already connected. A disconnected
   user sees a YouTube-only modal with no indication Spotify is supported, and no
   way to link from where they are. Linking currently lives only on the My Team
   settings banner.

A fourth, related gap: disconnecting Spotify leaves saved songs in place (correct
— they are database state on the team row, not browser state), but Spotify-sourced
tracks may not play. Nothing in the UI says which songs are affected.

## Non-Goals

- Converting `SongPicker` from raw Tailwind slate classes to the `var(--color-*)`
  design tokens used by `MyTeamForm`. Real inconsistency, separate cleanup.
- Changing the OAuth flow, the token exchange, or `disconnectSpotify` semantics.
- Server-side Spotify session storage. Tokens stay in `localStorage`, per-device.

## Design

### 1. Accent-colored close button

`src/components/SongPicker.tsx`

The close button takes `accentColor` from the `useLeagueTheme()` context the
component already consumes. Muted at rest (accent at ~70% opacity), full accent
on hover. Consistent with the tab underline, focus ring, and play chip.

### 2. Persistent YouTube hint

The hint moves out of the empty-results branch and becomes a small muted line
directly under the input, rendered whenever the YouTube tab is active —
regardless of query state. The empty-results slot keeps only "No results".

### 3. Spotify tab always visible, with inline linking

Both tabs always render. YouTube remains the default tab when disconnected, so
the common path is unchanged.

Selecting Spotify while disconnected replaces the search input and results with a
connect panel: Spotify mark, one line of copy, and a Connect button that calls the
existing `initiateSpotifyPopup` from `src/lib/spotifyAuth.ts`. No new auth code
path. On success the panel is replaced in place by live search, preserving any
typed query.

Structural change this requires: `isSpotifyConnected()` is currently called during
render, so it cannot react to a connection completing. It becomes React state
seeded from that call and updated by the popup success callback.

Cross-component consistency: when the modal closes, `MyTeamForm` re-checks
connection status so its banner cannot disagree with what the picker did.

### 4. "Won't play" badge on affected songs

`src/app/leagues/[slug]/my-team/MyTeamForm.tsx`

Beside the existing `SongSourceBadge`, a warning chip appears only on songs that
would genuinely be silent. The condition mirrors the real fallback chain in
`WalkUpPlayer`:

- `platform === "spotify"`, AND
- no `youtubeTrackId` (checked first at `WalkUpPlayer.tsx:240`), AND
- no `previewUrl` (the preview fallback in `playSpotifyFallback`), AND
- Spotify is currently disconnected

Songs with a YouTube fallback or a preview clip still play and get no badge.

The predicate is an exported function in `src/lib/spotifyAuth.ts`, not inline JSX,
so it is unit-testable without rendering.

## Testing

`tests/unit/songPicker.test.ts` already exists and is extended:

- The badge predicate: each of the four conditions, independently.
- Tab construction: both tabs present when disconnected; YouTube is the default
  tab when disconnected; Spotify is the default when connected.

`npm test` and `npm run build` must pass before the work is considered complete,
per AGENTS.md.

## Blast Radius

GitNexus `impact` was unavailable when this was written (the MCP server was
running a build older than the on-disk index), so callers were traced by search
instead. Verify with `impact` once the server is restarted.

- `SongPicker` is imported only by `MyTeamForm`.
- `initiateSpotifyPopup` is called only by `MyTeamForm` today; this design adds
  `SongPicker` as a second caller.
- `disconnectSpotify`, `getSpotifyToken`, and the OAuth routes are untouched.

## Known Adjacent Issues (out of scope, tracked here so they are not lost)

- `consumeSpotifyCallback` in `src/lib/spotifyAuth.ts` is dead code — nothing
  calls it. The full-page redirect flow therefore cannot store tokens; only the
  popup flow works.
- The `returnTo` origin check in `src/app/api/music/spotify-auth/route.ts` does a
  raw `startsWith` against `NEXT_PUBLIC_SITE_URL`. A www/apex mismatch silently
  degrades to `/teams` rather than failing loudly.
