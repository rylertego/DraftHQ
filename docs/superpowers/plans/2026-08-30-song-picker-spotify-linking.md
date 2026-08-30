# Song Picker Spotify Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Theme the song picker's close button, keep the YouTube hint visible while typing, let users link Spotify from inside the picker, and mark saved Spotify songs that would be silent while disconnected.

**Architecture:** Four small changes across three existing files. Anything that depends on interaction or connection state is extracted into a pure helper or an exported subcomponent, because this repo's tests render statically and cannot click. No new auth code — the picker reuses `initiateSpotifyPopup`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest 4 with `renderToStaticMarkup`.

## Global Constraints

- No `@testing-library/react` and no jsdom in this repo. Component assertions use
  `renderToStaticMarkup` from `react-dom/server`. Never write a test that clicks,
  types, or fires events.
- Tests live in `tests/unit/songPicker.test.ts` (already exists — extend it).
- `src/components/SongPicker.tsx` uses raw Tailwind slate classes and the
  `accentColor` from `useLeagueTheme()`. Match that. Do NOT convert it to the
  `var(--color-*)` tokens — explicitly out of scope per the spec.
- `src/app/leagues/[slug]/my-team/MyTeamForm.tsx` uses `var(--color-*)` design
  tokens. Match that file's convention when editing it.
- `LeagueThemeContext` has a default value of `#22D3EE`, so `SongPicker` renders
  without a provider in tests.
- Run `npm test` and `npm run build` before considering the work complete
  (AGENTS.md).
- Commit after every task.

---

### Task 1: `needsSpotifyReconnect` predicate

Pure function deciding whether a saved song would actually be silent. Mirrors the
real fallback chain in `WalkUpPlayer`: YouTube fallback is tried first
(`WalkUpPlayer.tsx:240`), then the preview clip (`playSpotifyFallback`). A song is
only silent when it has neither.

**Files:**
- Modify: `src/lib/spotifyAuth.ts` (append at end of file)
- Test: `tests/unit/songPicker.test.ts`

**Interfaces:**
- Consumes: `WalkUpSong` from `@/types/draft` (has optional `previewUrl?: string | null` and `youtubeTrackId?: string | null`)
- Produces: `needsSpotifyReconnect(song: WalkUpSong, spotifyConnected: boolean): boolean`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/songPicker.test.ts`:

```ts
describe("needsSpotifyReconnect", () => {
  const spotifySong: WalkUpSong = {
    platform: "spotify",
    trackId: "abc123",
    url: "https://open.spotify.com/track/abc123",
    title: "Song",
    artist: "Artist",
  };

  it("flags a Spotify song with no fallback while disconnected", () => {
    expect(needsSpotifyReconnect(spotifySong, false)).toBe(true);
  });

  it("does not flag anything while connected", () => {
    expect(needsSpotifyReconnect(spotifySong, true)).toBe(false);
  });

  it("does not flag YouTube songs", () => {
    const ytSong: WalkUpSong = { ...spotifySong, platform: "youtube" };
    expect(needsSpotifyReconnect(ytSong, false)).toBe(false);
  });

  it("does not flag a Spotify song with a YouTube fallback", () => {
    expect(needsSpotifyReconnect({ ...spotifySong, youtubeTrackId: "dQw4w9WgXcQ" }, false)).toBe(false);
  });

  it("does not flag a Spotify song with a preview clip", () => {
    expect(needsSpotifyReconnect({ ...spotifySong, previewUrl: "https://p.scdn.co/mp3/x" }, false)).toBe(false);
  });

  it("treats null fallbacks as absent", () => {
    expect(needsSpotifyReconnect({ ...spotifySong, youtubeTrackId: null, previewUrl: null }, false)).toBe(true);
  });
});
```

Add to the imports at the top of that file:

```ts
import { needsSpotifyReconnect } from "@/lib/spotifyAuth";
import type { WalkUpSong } from "@/types/draft";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: FAIL — `needsSpotifyReconnect is not a function` (it is not exported yet).

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/spotifyAuth.ts`:

```ts
/** A saved Spotify song is only truly silent when it has no YouTube fallback
 *  and no preview clip — WalkUpPlayer tries both before giving up. */
export function needsSpotifyReconnect(song: WalkUpSong, spotifyConnected: boolean): boolean {
  if (spotifyConnected) return false;
  if (song.platform !== "spotify") return false;
  return !song.youtubeTrackId && !song.previewUrl;
}
```

Add this import at the top of `src/lib/spotifyAuth.ts`, directly under the
`"use client"` directive:

```ts
import type { WalkUpSong } from "@/types/draft";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: PASS — all six new assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spotifyAuth.ts tests/unit/songPicker.test.ts
git commit -m "Add needsSpotifyReconnect predicate for silent walk-up songs"
```

---

### Task 2: "Reconnect to play" badge on My Team

**Files:**
- Modify: `src/app/leagues/[slug]/my-team/MyTeamForm.tsx` (add badge component near `SongSourceBadge` at line 19; use it in the song row at line 484)
- Test: `tests/unit/songPicker.test.ts`

**Interfaces:**
- Consumes: `needsSpotifyReconnect` from Task 1
- Produces: `SongPlaybackBadge` — exported, no props

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/songPicker.test.ts`:

```ts
describe("SongPlaybackBadge", () => {
  it("tells the owner the song needs Spotify reconnected", () => {
    const html = renderToStaticMarkup(createElement(SongPlaybackBadge));
    expect(html).toContain("Reconnect to play");
  });
});
```

Extend the existing `MyTeamForm` import line in that file to:

```ts
import { SpotifyConnectionPanel, SongPlaybackBadge } from "@/app/leagues/[slug]/my-team/MyTeamForm";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: FAIL — `SongPlaybackBadge` is not exported from MyTeamForm.

- [ ] **Step 3: Write minimal implementation**

In `src/app/leagues/[slug]/my-team/MyTeamForm.tsx`, directly after the
`SongSourceBadge` function (which ends at line 25), add:

```tsx
export function SongPlaybackBadge() {
  return (
    <span className="rounded-full border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--color-warning)]">
      Reconnect to play
    </span>
  );
}
```

(`--color-warning` is defined in `src/app/globals.css:67` as `#D97706`, alongside
`--color-warning-border` at line 70. Both exist — no substitution needed.)

Then in the song row, find this line (around line 484):

```tsx
                        <SongSourceBadge platform={song.platform} />
```

and replace it with:

```tsx
                        <SongSourceBadge platform={song.platform} />
                        {needsSpotifyReconnect(song, spotifyConnected) && <SongPlaybackBadge />}
```

Add `needsSpotifyReconnect` to the existing `@/lib/spotifyAuth` import at line 8:

```tsx
import { disconnectSpotify, initiateSpotifyPopup, isSpotifyConnected, needsSpotifyReconnect } from "@/lib/spotifyAuth";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/leagues/\[slug\]/my-team/MyTeamForm.tsx tests/unit/songPicker.test.ts
git commit -m "Badge walk-up songs that cannot play while Spotify is disconnected"
```

---

### Task 3: Accent close button and persistent YouTube hint

**Files:**
- Modify: `src/components/SongPicker.tsx` (close button at line 147; hint currently at line 196)
- Test: `tests/unit/songPicker.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: no new exports; `SongPicker`'s default export gains `aria-label="Close"` on its close button

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/songPicker.test.ts`:

```ts
describe("SongPicker chrome", () => {
  function render() {
    return renderToStaticMarkup(
      createElement(SongPicker, { onSelect: () => undefined, onClose: () => undefined }),
    );
  }

  it("paints the close button in the league accent color", () => {
    expect(render()).toMatch(/<button[^>]*aria-label="Close"[^>]*style="[^"]*color:#22D3EE/);
  });

  it("keeps the YouTube paste hint visible", () => {
    expect(render()).toContain("Find the song on YouTube, copy the link, and paste it above.");
  });
});
```

Add to the imports at the top of that file:

```ts
import SongPicker from "@/components/SongPicker";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: FAIL on the first assertion — the close button has no `aria-label` and
uses `text-slate-400`, so the regex does not match.

- [ ] **Step 3: Write minimal implementation**

In `src/components/SongPicker.tsx`, replace the close button (line 147):

```tsx
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
```

with — keep this exact prop order, the test regex depends on `aria-label`
preceding `style`:

```tsx
          <button
            onClick={onClose}
            aria-label="Close"
            className="opacity-70 transition-opacity hover:opacity-100"
            style={{ color: accentColor }}
          >
```

Then add the persistent hint. Directly below the `<input …/>` element (which ends
around line 184) and above the `{error && …}` line, insert:

```tsx
          {tab === "youtube" && (
            <p className="text-xs text-slate-500">
              Find the song on YouTube, copy the link, and paste it above.
            </p>
          )}
```

Finally remove the now-duplicated empty-state hint. Delete this whole block
(around line 193):

```tsx
            {!loading && results.length === 0 && !debouncedQuery && tab === "youtube" && (
              <div className="flex items-center justify-center py-8 text-center text-sm text-slate-500">
                Find the song on YouTube, copy the link, and paste it above.
              </div>
            )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: PASS — and the hint assertion still passes because the new persistent
copy is identical.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongPicker.tsx tests/unit/songPicker.test.ts
git commit -m "Theme the song picker close button and pin the YouTube hint"
```

---

### Task 4: Always-visible Spotify tab with inline linking

Both tabs always render, in fixed order (YouTube, Spotify) so the tab strip never
reorders itself. Which tab opens selected depends on connection state.

**Files:**
- Modify: `src/components/SongPicker.tsx` (tab list at line 134; state at line 71; content area at line 174)
- Modify: `src/app/leagues/[slug]/my-team/MyTeamForm.tsx` (picker `onClose` at line 529)
- Test: `tests/unit/songPicker.test.ts`

**Interfaces:**
- Consumes: `initiateSpotifyPopup`, `isSpotifyConnected` from `@/lib/spotifyAuth`
- Produces:
  - `SONG_PICKER_TABS: readonly SongPickerTabId[]` — always `["youtube", "spotify"]`
  - `defaultSongPickerTab(connected: boolean): SongPickerTabId`
  - `SpotifyConnectPanel` — props `{ accentColor: string; connecting: boolean; onConnect: () => void }`
  - `type SongPickerTabId = "youtube" | "spotify"`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/songPicker.test.ts`:

```ts
describe("song picker tabs", () => {
  it("always offers both sources", () => {
    expect(SONG_PICKER_TABS).toEqual(["youtube", "spotify"]);
  });

  it("opens on YouTube when Spotify is not linked", () => {
    expect(defaultSongPickerTab(false)).toBe("youtube");
  });

  it("opens on Spotify once linked", () => {
    expect(defaultSongPickerTab(true)).toBe("spotify");
  });
});

describe("SpotifyConnectPanel", () => {
  it("offers to link Spotify without leaving the picker", () => {
    const html = renderToStaticMarkup(
      createElement(SpotifyConnectPanel, {
        accentColor: "#22D3EE",
        connecting: false,
        onConnect: () => undefined,
      }),
    );
    expect(html).toContain("Connect Spotify");
  });

  it("shows progress while the popup is open", () => {
    const html = renderToStaticMarkup(
      createElement(SpotifyConnectPanel, {
        accentColor: "#22D3EE",
        connecting: true,
        onConnect: () => undefined,
      }),
    );
    expect(html).toContain("Opening Spotify");
    expect(html).toContain("disabled");
  });
});
```

Extend the `SongPicker` import added in Task 3 to:

```ts
import SongPicker, {
  SONG_PICKER_TABS,
  defaultSongPickerTab,
  SpotifyConnectPanel,
} from "@/components/SongPicker";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: FAIL — none of `SONG_PICKER_TABS`, `defaultSongPickerTab`, or
`SpotifyConnectPanel` exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/components/SongPicker.tsx`:

**3a.** Extend the React import at line 2 and add the auth import:

```tsx
import { useState, useEffect, useRef, type ComponentType } from "react";
import { isSpotifyConnected, initiateSpotifyPopup } from "@/lib/spotifyAuth";
```

(The file already imports `isSpotifyConnected`; replace that line rather than
adding a duplicate.)

**3b.** Add above the `Props` interface (around line 63):

```tsx
export type SongPickerTabId = "youtube" | "spotify";

export const SONG_PICKER_TABS: readonly SongPickerTabId[] = ["youtube", "spotify"];

export function defaultSongPickerTab(connected: boolean): SongPickerTabId {
  return connected ? "spotify" : "youtube";
}

const TAB_META: Record<SongPickerTabId, { label: string; Icon: ComponentType }> = {
  youtube: { label: "YouTube", Icon: YoutubeLogo },
  spotify: { label: "Spotify", Icon: SpotifyLogo },
};

export function SpotifyConnectPanel({
  accentColor,
  connecting,
  onConnect,
}: {
  accentColor: string;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span style={{ color: accentColor }}>
        <SpotifyLogo />
      </span>
      <p className="text-sm text-slate-300">
        Link Spotify to search tracks without leaving this page.
      </p>
      <button
        onClick={onConnect}
        disabled={connecting}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-950 transition-opacity disabled:opacity-60"
        style={{ background: accentColor }}
      >
        {connecting ? "Opening Spotify…" : "Connect Spotify"}
      </button>
    </div>
  );
}
```

**3c.** Replace the connection/tab state. Delete line 71:

```tsx
  const spotifyFirst = isSpotifyConnected();
  const [tab, setTab] = useState<"youtube" | "spotify">(spotifyFirst ? "spotify" : "youtube");
```

with:

```tsx
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tab, setTab] = useState<SongPickerTabId>("youtube");
```

Then extend the existing focus effect (line 78) by adding a second effect
directly after it. Reading connection state in an effect rather than during
render keeps server and client markup identical:

```tsx
  useEffect(() => {
    const linked = isSpotifyConnected();
    setConnected(linked);
    setTab(defaultSongPickerTab(linked));
  }, []);
```

**3d.** Add the connect handler, directly above `handleSelect` (line 121):

```tsx
  function handleConnect() {
    setConnecting(true);
    initiateSpotifyPopup(() => {
      setConnected(true);
      setConnecting(false);
    });
  }
```

**3e.** Replace the `tabs` array (lines 134-136):

```tsx
  const tabs = spotifyFirst
    ? [{ id: "spotify" as const, label: "Spotify", Icon: SpotifyLogo }, { id: "youtube" as const, label: "YouTube", Icon: YoutubeLogo }]
    : [{ id: "youtube" as const, label: "YouTube", Icon: YoutubeLogo }];
```

with:

```tsx
  const tabs = SONG_PICKER_TABS.map((id) => ({ id, ...TAB_META[id] }));
```

**3f.** Gate the content area. Find the opening of the content div (line 174):

```tsx
        <div className="p-4 space-y-3">
          <input
```

Change it to:

```tsx
        <div className="p-4 space-y-3">
          {tab === "spotify" && !connected ? (
            <SpotifyConnectPanel accentColor={accentColor} connecting={connecting} onConnect={handleConnect} />
          ) : (
            <>
          <input
```

and close the fragment. The content div currently ends with the results
`</div>` followed by `</div>`. Change that closing sequence from:

```tsx
          </div>
        </div>
      </div>
    </div>
  );
```

to:

```tsx
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
```

**3g.** In `src/app/leagues/[slug]/my-team/MyTeamForm.tsx`, keep the page banner in
sync with a link made inside the picker. Change the picker's `onClose` (line 529):

```tsx
          onClose={() => setShowSongPicker(false)}
```

to:

```tsx
          onClose={() => {
            setShowSongPicker(false);
            setSpotifyConnected(isSpotifyConnected());
          }}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: PASS

Then run the full suite and the build:

Run: `npm test -- --run`
Expected: all files pass (244 existing tests plus the new ones).

Run: `npm run build`
Expected: compiles with no type errors. If TypeScript complains that `connecting`
or `connected` is unused, a step above was skipped.

- [ ] **Step 5: Commit**

```bash
git add src/components/SongPicker.tsx src/app/leagues/\[slug\]/my-team/MyTeamForm.tsx tests/unit/songPicker.test.ts
git commit -m "Let users link Spotify from inside the song picker"
```

---

## Verification

After Task 4, verify in the running app — the picker is at
League → My Team → Add Song:

1. Disconnected: both tabs show; YouTube is selected; the paste hint stays visible
   while typing; the X is accent-colored.
2. Click the Spotify tab while disconnected: the connect panel appears with a
   working Connect button.
3. Saved Spotify songs with no fallback show "Reconnect to play" in the list.

Note: end-to-end Spotify linking cannot be confirmed until the production
`NEXT_PUBLIC_SITE_URL` www/apex mismatch is fixed and redeployed — that is a
deployment config issue, not part of this plan. Local verification uses the
values in `.env.local`.

## Known Deviations From The Spec

- The spec left tab order open. This plan fixes the order as (YouTube, Spotify)
  and varies only which tab starts selected, so the strip does not reorder when
  connection state changes.
- `SpotifyConnectPanel` inherits an existing flaw from `MyTeamForm`: if the user
  closes the Spotify popup without authorizing, `connecting` stays true until the
  modal is reopened, because `initiateSpotifyPopup` only invokes its callback on
  success. Mirrored deliberately rather than fixed here, to keep both call sites
  behaving identically. Worth a follow-up.
