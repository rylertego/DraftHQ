# Commissioner Team Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let commissioners and co-commissioners edit any team's full profile — including TTS name, owner photo, and walk-up songs — from the existing My Team editor, with a team switcher, and retire the reduced Edit Team modal.

**Architecture:** One route and one editor. `MyTeamForm` gains a manager-only team selector and picks its save function by whether the selected team is the user's own. Decision logic that would otherwise need interaction is extracted as pure functions, because this repo's tests cannot fire events. The roster's Edit action becomes a link, and the modal's owner controls move onto the Teams page so nothing is lost.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Supabase, Vitest 4 with `renderToStaticMarkup`.

## Global Constraints

- No `@testing-library/react` and no jsdom. Component assertions use
  `renderToStaticMarkup` from `react-dom/server`. Never write a test that clicks,
  types, or fires events. Extract logic to pure functions instead.
- `src/app/leagues/[slug]/**` uses the `var(--color-*)` design tokens and the
  shared components from `@/components/ui` (`Button`, `Field`, `Input`, `Panel`,
  `Alert`, `IconButton`, `Dialog`). Match that. Raw Tailwind color classes are
  wrong in these files.
- `IconButton` and `Button` default to `scope="product"`. Inside a league page
  pass `scope="league"` so they take the league accent.
- NO database migration. Verified against the live project: `tts_name`,
  `walk_up_songs`, and `owner_photo_url` already have UPDATE grants for
  `authenticated`.
- `canManage` from `useWorkspace()` is already true for the league owner,
  commissioners, and co-commissioners (`src/lib/leagueApi.ts:326`). Do not add a
  new role check.
- The MyTeamForm path contains literal square brackets. Quote or escape it in
  shell commands.
- Run `npm test -- --run` and `npm run build` before the final commit of each
  task. Commit after every task.

## Deviation From The Spec

The spec says the team selector orders teams "by draft position". `LeagueTeam`
(`src/types/league.ts:81`) has **no** `draftPosition` field — draft position
belongs to a draft team, not a league team. This plan orders the selector
alphabetically by team name instead.

---

### Task 1: `ttsName` on the commissioner save path

`updateLeagueTeamDetails` builds a partial patch and is missing `ttsName`, so a
commissioner cannot save another team's announcer name.

**Files:**
- Modify: `src/lib/leagueApi.ts:980-1007`
- Test: `tests/unit/leagueTeamPatch.test.ts` (new)

**Interfaces:**
- Produces: `buildLeagueTeamPatch(data: UpdateLeagueTeamDetailsData): Record<string, unknown>` — exported for testing; `updateLeagueTeamDetails` uses it.
- `UpdateLeagueTeamDetailsData` gains `ttsName?: string | null`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/leagueTeamPatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildLeagueTeamPatch } from "@/lib/leagueApi";

describe("buildLeagueTeamPatch", () => {
  it("omits every field that was not supplied", () => {
    expect(buildLeagueTeamPatch({})).toEqual({});
  });

  it("maps supplied fields to snake_case columns", () => {
    expect(buildLeagueTeamPatch({ name: "  Trap Queens  ", ttsName: " Queens " })).toEqual({
      name: "Trap Queens",
      tts_name: "Queens",
    });
  });

  it("treats a blank tts name as clearing it", () => {
    expect(buildLeagueTeamPatch({ ttsName: "   " })).toEqual({ tts_name: null });
  });

  it("passes an explicit null through as a clear", () => {
    expect(buildLeagueTeamPatch({ ttsName: null })).toEqual({ tts_name: null });
  });

  it("carries walk-up songs and photo fields untouched", () => {
    const songs = [{ platform: "youtube" as const, trackId: "a", url: "u", title: "t" }];
    expect(buildLeagueTeamPatch({ walkUpSongs: songs, ownerPhotoUrl: null })).toEqual({
      walk_up_songs: songs,
      owner_photo_url: null,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/leagueTeamPatch.test.ts`
Expected: FAIL — `buildLeagueTeamPatch` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/leagueApi.ts`, add `ttsName` to the interface:

```ts
export interface UpdateLeagueTeamDetailsData {
  name?: string;
  shortName?: string | null;
  ownerName?: string | null;
  logoUrl?: string | null;
  ownerPhotoUrl?: string | null;
  walkUpSongs?: WalkUpSong[];
  ttsName?: string | null;
}
```

Then extract the patch builder and use it. Replace the body of
`updateLeagueTeamDetails` down to the `supabase` call:

```ts
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

export async function updateLeagueTeamDetails(leagueId: string, teamId: string, data: UpdateLeagueTeamDetailsData): Promise<void> {
  const patch = buildLeagueTeamPatch(data);

  const { error } = await supabase
    .from("league_teams")
    .update(patch)
    .eq("id", teamId)
    .eq("league_id", leagueId)
    .select("id")
    .single();

  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/leagueTeamPatch.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/leagueApi.ts tests/unit/leagueTeamPatch.test.ts
git commit -m "Let the commissioner save path write tts_name"
```

---

### Task 2: Team-switcher decision logic

Two pure functions the form needs. Extracted because the switcher cannot be
exercised by this repo's tests.

**Files:**
- Create: `src/lib/teamEditing.ts`
- Test: `tests/unit/teamEditing.test.ts` (new)

**Interfaces:**
- Produces:
  - `resolveInitialTeamId(teamIdParam: string | null, myTeamId: string | null, teamIds: string[]): string | null`
  - `isTeamProfileDirty(form: TeamProfileFields, team: TeamProfileFields, hasPendingUpload: boolean): boolean`
  - `interface TeamProfileFields { name: string; shortName: string; ownerName: string; ttsName: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/teamEditing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveInitialTeamId, isTeamProfileDirty } from "@/lib/teamEditing";

describe("resolveInitialTeamId", () => {
  const teams = ["t1", "t2", "t3"];

  it("honours a valid teamId param above everything else", () => {
    expect(resolveInitialTeamId("t3", "t1", teams)).toBe("t3");
  });

  it("ignores a teamId that is not in this league", () => {
    expect(resolveInitialTeamId("other", "t1", teams)).toBe("t1");
  });

  it("falls back to the viewer's own team", () => {
    expect(resolveInitialTeamId(null, "t2", teams)).toBe("t2");
  });

  it("falls back to the first team when the viewer owns none", () => {
    expect(resolveInitialTeamId(null, null, teams)).toBe("t1");
  });

  it("returns null when the league has no teams", () => {
    expect(resolveInitialTeamId(null, null, [])).toBeNull();
  });

  it("ignores an own-team id that is no longer in the league", () => {
    expect(resolveInitialTeamId(null, "deleted", teams)).toBe("t1");
  });
});

describe("isTeamProfileDirty", () => {
  const saved = { name: "Team 8", shortName: "T8", ownerName: "Tyler", ttsName: "Trap Queens" };

  it("is clean when nothing changed", () => {
    expect(isTeamProfileDirty({ ...saved }, saved, false)).toBe(false);
  });

  it("notices an edited field", () => {
    expect(isTeamProfileDirty({ ...saved, name: "Team 9" }, saved, false)).toBe(true);
  });

  it("notices a pending file upload with no text edits", () => {
    expect(isTeamProfileDirty({ ...saved }, saved, true)).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(isTeamProfileDirty({ ...saved, name: "  Team 8  " }, saved, false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/teamEditing.test.ts`
Expected: FAIL — `@/lib/teamEditing` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/teamEditing.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/teamEditing.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/teamEditing.ts tests/unit/teamEditing.test.ts
git commit -m "Add team switcher decision helpers"
```

---

### Task 3: Sidebar label

**Files:**
- Modify: `src/app/leagues/[slug]/WorkspaceLayoutClient.tsx:42` and `:129` (two nav lists — desktop and mobile; BOTH must change)
- Modify: `src/lib/teamEditing.ts`
- Test: `tests/unit/teamEditing.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `teamNavLabel(canManage: boolean): string`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/teamEditing.test.ts`:

```ts
describe("teamNavLabel", () => {
  it("says Teams for anyone who can manage the league", () => {
    expect(teamNavLabel(true)).toBe("Teams");
  });

  it("says My Team for a plain member", () => {
    expect(teamNavLabel(false)).toBe("My Team");
  });
});
```

Extend that file's import to:

```ts
import { resolveInitialTeamId, isTeamProfileDirty, teamNavLabel } from "@/lib/teamEditing";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/teamEditing.test.ts`
Expected: FAIL — `teamNavLabel` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/teamEditing.ts`:

```ts
/** Managers edit any team from this entry, so "My Team" would understate it. */
export function teamNavLabel(canManage: boolean): string {
  return canManage ? "Teams" : "My Team";
}
```

In `WorkspaceLayoutClient.tsx`, import it:

```tsx
import { teamNavLabel } from "@/lib/teamEditing";
```

Then find where `canManage` is available in that component. Read the file first —
if the component does not already have it, get it from `useWorkspace()`:

```tsx
const { workspace } = useWorkspace();
const canManage = Boolean(workspace?.canManage);
```

(`useWorkspace` is imported from `@/context/LeagueWorkspaceContext`. If the file
already reads the workspace, reuse that — do not call the hook twice.)

Replace BOTH occurrences of:

```tsx
      label: "My Team",
```

with:

```tsx
      label: teamNavLabel(canManage),
```

There are exactly two, at roughly lines 42 and 129. Missing the second leaves the
mobile nav inconsistent with the desktop nav.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run tests/unit/teamEditing.test.ts`
Expected: PASS

Run: `npm run build`
Expected: compiles. A missing `canManage` binding shows up here as a type error.

- [ ] **Step 5: Commit**

```bash
git add src/lib/teamEditing.ts tests/unit/teamEditing.test.ts src/app/leagues/\[slug\]/WorkspaceLayoutClient.tsx
git commit -m "Label the team nav entry Teams for league managers"
```

---

### Task 4: Team switcher in the editor

The largest task. `MyTeamForm` currently loads `workspace.myTeam` and saves with
`updateMyLeagueTeamDetails`. It gains a selected-team concept.

**Files:**
- Modify: `src/app/leagues/[slug]/my-team/MyTeamForm.tsx`
- Modify: `src/app/leagues/[slug]/my-team/page.tsx`
- Test: `tests/unit/teamEditing.test.ts` (already covers the helpers; no new tests here — see note in Step 4)

**Interfaces:**
- Consumes: `resolveInitialTeamId`, `isTeamProfileDirty` (Task 2); `updateLeagueTeamDetails` with `ttsName` (Task 1)
- Produces: no new exports

- [ ] **Step 1: Read the current file end to end**

Run: `cat "src/app/leagues/[slug]/my-team/MyTeamForm.tsx"`

You must understand the existing `persistSongs`, `handleSave`, `closeSongPicker`,
and the `useEffect` that loads the team before editing. Do not skip this.

- [ ] **Step 2: Load every team, not just your own**

The load effect currently calls `getLeagueTeams(league.id)` and then picks
`myTeamRef.id` out of the result. Keep the same call, but keep the whole list:

```tsx
  const [teams, setTeams] = useState<LeagueTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
```

In the load effect, after `getLeagueTeams` resolves, sort and store all of them,
then resolve which one to open. Replace the `const found = ...` line and the
`if (!found) return;` guard with:

```tsx
        const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
        setTeams(sorted);
        const initialId = resolveInitialTeamId(
          teamIdParam,
          myTeamRef?.id ?? null,
          sorted.map((t) => t.id)
        );
        setSelectedTeamId(initialId);
        const found = sorted.find((t) => t.id === initialId) ?? null;
        if (!found) return;
```

Note the callback parameter is already named `teams`; rename the incoming
parameter to avoid shadowing the new state — e.g. `.then((leagueTeams) => {` and
sort `leagueTeams`.

`teamIdParam` comes from the page (Step 6). Add `LeagueTeam` to the existing
`@/types/league` type import if it is not already there.

- [ ] **Step 3: Add a `selectTeam` function**

Place it next to `closeSongPicker`:

```tsx
  function selectTeam(nextId: string) {
    if (nextId === selectedTeamId) return;
    if (
      team &&
      isTeamProfileDirty(
        { name, shortName, ownerName, ttsName },
        {
          name: team.name,
          shortName: team.shortName ?? "",
          ownerName: team.ownerName ?? "",
          ttsName: team.ttsName ?? "",
        },
        Boolean(logoFile || ownerPhotoFile)
      ) &&
      !window.confirm("Discard unsaved changes to this team?")
    ) {
      return;
    }

    const next = teams.find((t) => t.id === nextId);
    if (!next) return;
    setSelectedTeamId(nextId);
    setTeam(next);
    setName(next.name);
    setShortName(next.shortName ?? "");
    setOwnerName(next.ownerName ?? "");
    setWalkUpSongs(Array.isArray(next.walkUpSongs) ? next.walkUpSongs : []);
    setTtsName(next.ttsName ?? "");
    setLogoPreview(next.logoUrl);
    setOwnerPhotoPreview(next.ownerPhotoUrl);
    setLogoFile(null);
    setOwnerPhotoFile(null);
    setError("");
    setSuccess(false);
  }
```

- [ ] **Step 4: Split the save paths**

Add this derived flag near `const league = workspace?.league;`:

```tsx
  const isOwnTeam = Boolean(team && myTeamRef && team.id === myTeamRef.id);
```

In `persistSongs`, replace the single `updateMyLeagueTeamDetails` call with a
branch. The own-team path is unchanged; the manager path is a partial patch, so
it sends only the songs:

```tsx
      if (isOwnTeam) {
        const updated = await updateMyLeagueTeamDetails(league.id, team.id, {
          name: team.name,
          shortName: team.shortName ?? null,
          ownerName: team.ownerName ?? null,
          logoUrl: team.logoUrl,
          ownerPhotoUrl: team.ownerPhotoUrl,
          walkUpSongs: songs,
          ttsName: team.ttsName ?? null,
          lastSeasonPickPlayer: team.lastSeasonPickPlayer,
          lastSeasonRecord: team.lastSeasonRecord,
          lastSeasonPlayoffs: team.lastSeasonPlayoffs,
        });
        applyUpdatedTeam(updated);
      } else {
        await updateLeagueTeamDetails(league.id, team.id, { walkUpSongs: songs });
        applyUpdatedTeam({ ...team, walkUpSongs: songs });
      }
```

`updateLeagueTeamDetails` returns void, hence the locally merged team. Add this
helper next to `persistSongs` so both save paths keep the list in sync:

```tsx
  /** Keep `team`, the form's song list, and the switcher's copy in agreement —
   *  the selector reads from `teams`, so a save that skipped it would show
   *  stale data the moment you switched away and back. */
  function applyUpdatedTeam(updated: LeagueTeam) {
    setTeam(updated);
    setWalkUpSongs(updated.walkUpSongs);
    setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }
```

In `handleSave`, apply the same branch after the two uploads. Own team keeps the
existing full-field call; the manager path sends exactly the edited fields:

```tsx
      if (isOwnTeam) {
        const updated = await updateMyLeagueTeamDetails(league.id, team.id, {
          name: name.trim(),
          shortName: shortName.trim() || null,
          ownerName: ownerName.trim() || null,
          logoUrl,
          ownerPhotoUrl,
          walkUpSongs: walkUpSongs.slice(0, MAX_WALK_UP_SONGS),
          ttsName: ttsName.trim() || null,
          lastSeasonPickPlayer: team.lastSeasonPickPlayer,
          lastSeasonRecord: team.lastSeasonRecord,
          lastSeasonPlayoffs: team.lastSeasonPlayoffs,
        });
        applyUpdatedTeam(updated);
        setName(updated.name);
        setShortName(updated.shortName ?? "");
        setOwnerName(updated.ownerName ?? "");
        setTtsName(updated.ttsName ?? "");
        setLogoPreview(updated.logoUrl);
        setOwnerPhotoPreview(updated.ownerPhotoUrl);
      } else {
        await updateLeagueTeamDetails(league.id, team.id, {
          name: name.trim(),
          shortName: shortName.trim() || null,
          ownerName: ownerName.trim() || null,
          logoUrl,
          ownerPhotoUrl,
          walkUpSongs: walkUpSongs.slice(0, MAX_WALK_UP_SONGS),
          ttsName: ttsName.trim() || null,
        });
        applyUpdatedTeam({
          ...team,
          name: name.trim(),
          shortName: shortName.trim() || null,
          ownerName: ownerName.trim() || null,
          logoUrl,
          ownerPhotoUrl,
          walkUpSongs: walkUpSongs.slice(0, MAX_WALK_UP_SONGS),
          ttsName: ttsName.trim() || null,
        });
      }
```

Keep the existing `setLogoFile(null)`, `setOwnerPhotoFile(null)`, and
`setSuccess(true)` lines after the branch.

Add the import:

```tsx
import { updateLeagueTeamDetails } from "@/lib/leagueApi";
```

(extend the existing `@/lib/leagueApi` import rather than adding a second one),
plus:

```tsx
import { resolveInitialTeamId, isTeamProfileDirty } from "@/lib/teamEditing";
```

**Testing note:** the switcher itself cannot be unit-tested here — no jsdom, and
`MyTeamForm` needs workspace context. Its logic is already covered by Task 2's
tests. Do not add a rendering test for this component.

- [ ] **Step 5: Render the selector**

Above the first `<Panel>` in the returned JSX, and only for managers:

```tsx
          {canManage && teams.length > 1 && (
            <div className="rounded-[var(--radius-surface)] border border-[color:var(--color-border-subtle)] bg-[var(--color-surface-2)] px-[var(--space-4)] py-[var(--space-3)]">
              <Field label="Editing team" controlId="team-switcher">
                <Select
                  id="team-switcher"
                  value={selectedTeamId ?? ""}
                  onChange={(e) => selectTeam(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {myTeamRef && t.id === myTeamRef.id ? " (your team)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
```

Add near the other derived values:

```tsx
  const canManage = Boolean(workspace?.canManage);
```

- [ ] **Step 6: Accept the `teamId` param**

Replace `src/app/leagues/[slug]/my-team/page.tsx` entirely:

```tsx
import MyTeamForm from "./MyTeamForm";

export default async function MyTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ teamId?: string }>;
}) {
  const { slug } = await params;
  const { teamId } = await searchParams;
  return <MyTeamForm slug={slug} teamId={teamId ?? null} />;
}
```

And change the component signature in `MyTeamForm.tsx`:

```tsx
export default function MyTeamForm({ slug, teamId: teamIdParam }: { slug: string; teamId?: string | null }) {
```

Keep the existing `void slug;` line.

- [ ] **Step 7: Verify**

Run: `npm test -- --run`
Expected: all files pass.

Run: `npm run build`
Expected: compiles with no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/leagues/\[slug\]/my-team/MyTeamForm.tsx src/app/leagues/\[slug\]/my-team/page.tsx
git commit -m "Let league managers edit any team from one editor"
```

---

### Task 5: Retire the Edit Team modal

The modal's owner controls must land on the Teams page before it is deleted, or
two capabilities disappear.

**Files:**
- Modify: `src/app/leagues/[slug]/my-team/MyTeamForm.tsx` (add the Owner panel)
- Modify: `src/app/leagues/[slug]/teams/LeagueTeams.tsx` (delete `EditTeamModal`, redirect the action)
- Test: `tests/unit/songPicker.test.ts`

**Interfaces:**
- Consumes: everything from Task 4
- Produces: `TeamOwnerPanel` exported from `MyTeamForm.tsx` — props `{ ownerDisplayName: string | null; members: Array<{ userId: string; displayName: string }>; selectedOwnerUserId: string; onAssign: (userId: string) => void; onInvite: (email: string) => void; assigning: boolean; inviting: boolean }`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/songPicker.test.ts`:

```ts
describe("TeamOwnerPanel", () => {
  const members = [{ userId: "u1", displayName: "Tyler" }];

  it("offers assignment and invitation for an unowned team", () => {
    const html = renderToStaticMarkup(
      createElement(TeamOwnerPanel, {
        ownerDisplayName: null,
        members,
        selectedOwnerUserId: "",
        onAssign: () => undefined,
        onInvite: () => undefined,
        assigning: false,
        inviting: false,
      }),
    );
    expect(html).toContain("Unassigned");
    expect(html).toContain("Tyler");
  });

  it("names the current owner", () => {
    const html = renderToStaticMarkup(
      createElement(TeamOwnerPanel, {
        ownerDisplayName: "Tyler",
        members,
        selectedOwnerUserId: "u1",
        onAssign: () => undefined,
        onInvite: () => undefined,
        assigning: false,
        inviting: false,
      }),
    );
    expect(html).toContain("Tyler");
    expect(html).not.toContain("Unassigned");
  });
});
```

Extend the existing MyTeamForm import in that file:

```ts
import { SongPlaybackBadge, TeamOwnerPanel } from "@/app/leagues/[slug]/my-team/MyTeamForm";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: FAIL — `TeamOwnerPanel` is not exported.

- [ ] **Step 3: Build the Owner panel**

First read the modal's owner section for the exact behavior to carry over:

Run: `sed -n '240,420p' "src/app/leagues/[slug]/teams/LeagueTeams.tsx"`

Then add to `MyTeamForm.tsx`, beside `SongPlaybackBadge`:

```tsx
export function TeamOwnerPanel({
  ownerDisplayName,
  members,
  selectedOwnerUserId,
  onAssign,
  onInvite,
  assigning,
  inviting,
}: {
  ownerDisplayName: string | null;
  members: Array<{ userId: string; displayName: string }>;
  selectedOwnerUserId: string;
  onAssign: (userId: string) => void;
  onInvite: (email: string) => void;
  assigning: boolean;
  inviting: boolean;
}) {
  const [email, setEmail] = useState("");
  return (
    <Panel title="Owner">
      <p className="text-sm leading-6 text-[color:var(--color-text-secondary)]">
        Current owner: {ownerDisplayName ?? "Unassigned"}
      </p>

      <Field label="Assign a league member" controlId="team-owner-select">
        <Select
          id="team-owner-select"
          value={selectedOwnerUserId}
          disabled={assigning}
          onChange={(e) => onAssign(e.target.value)}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.displayName}</option>
          ))}
        </Select>
      </Field>

      <Field label="Or invite by email" controlId="team-owner-invite">
        <div className="flex gap-[var(--space-2)]">
          <Input
            id="team-owner-invite"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
          />
          <Button
            scope="league"
            onClick={() => { onInvite(email.trim()); setEmail(""); }}
            disabled={!email.trim() || inviting}
            loading={inviting}
          >
            Invite
          </Button>
        </div>
      </Field>
    </Panel>
  );
}
```

`Input` forwards standard input attributes, and `Select` takes standard select
attributes with `<option>` children (see `LeagueTeams.tsx:461` for the exact
pattern this mirrors). Import both, plus `Field`, from `@/components/ui` — extend
the import already at the top of `MyTeamForm.tsx`.

- [ ] **Step 4: Wire it into the form**

Render it after the walk-up songs Panel, managers only:

```tsx
          {canManage && team && (
            <TeamOwnerPanel
              ownerDisplayName={team.ownerDisplayName}
              members={(workspace?.members ?? []).map((m) => ({
                userId: m.userId,
                displayName: m.displayName ?? "Member",
              }))}
              selectedOwnerUserId={team.ownerUserId ?? ""}
              assigning={assigningOwner}
              inviting={invitingOwner}
              onAssign={handleAssignOwner}
              onInvite={handleInviteOwner}
            />
          )}
```

Add the state and handlers next to `handleSave`:

```tsx
  const [assigningOwner, setAssigningOwner] = useState(false);
  const [invitingOwner, setInvitingOwner] = useState(false);

  async function handleAssignOwner(userId: string) {
    if (!team || !league) return;
    setAssigningOwner(true);
    setError("");
    try {
      await assignLeagueTeamOwner(league.id, team.id, userId || null);
      const refreshed = await getLeagueTeams(league.id);
      const updated = refreshed.find((t) => t.id === team.id);
      if (updated) applyUpdatedTeam(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign that owner.");
    } finally {
      setAssigningOwner(false);
    }
  }

  async function handleInviteOwner(email: string) {
    if (!team || !league || !email) return;
    setInvitingOwner(true);
    setError("");
    try {
      await inviteLeagueMember(league.id, email, { leagueTeamId: team.id });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send that invite.");
    } finally {
      setInvitingOwner(false);
    }
  }
```

Both signatures are confirmed, so use them as written above:

- `assignLeagueTeamOwner(leagueId: string, teamId: string, userId: string | null): Promise<void>` (`leagueApi.ts:1140`) — passing `null` unassigns, which is what the empty `<option value="">` produces.
- `inviteLeagueMember(leagueId: string, email: string, target?: { leagueTeamId?: string; draftTeamId?: string })` (`leagueApi.ts:489`).

Add both to the existing `@/lib/leagueApi` import rather than adding a second
import statement.

- [ ] **Step 5: Redirect the roster action and delete the modal**

In `src/app/leagues/[slug]/teams/LeagueTeams.tsx`:

- Change the two Edit entry points (around lines 658 and 723) to navigate to
  `/leagues/${slug}/my-team?teamId=${team.id}` instead of calling `onEdit`.
  Use `next/link` if the surrounding markup is a link, or `useRouter().push` if
  it is a menu item action. Read the surrounding code and match it.
- Delete `EditTeamModal` and its render site (around line 900), plus the
  `editingTeam` state and any `onEdit` props that are now unused.
- Remove imports that become unused (`updateLeagueTeamDetails`,
  `assignLeagueTeamOwner`, `inviteLeagueMember`, `Dialog`, and others). The build
  will name them if you miss one.

Do NOT remove anything else the roster does — listing, archiving, team counts all
stay.

- [ ] **Step 6: Verify**

Run: `npx vitest --run tests/unit/songPicker.test.ts`
Expected: PASS

Run: `npm test -- --run`
Expected: all files pass.

Run: `npm run build`
Expected: compiles with no unused-import or type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/leagues/\[slug\]/my-team/MyTeamForm.tsx src/app/leagues/\[slug\]/teams/LeagueTeams.tsx tests/unit/songPicker.test.ts
git commit -m "Move owner assignment onto the team editor and retire the modal"
```

---

## Verification

Cannot be automated here — the pages sit behind login and this repo has no
browser-driven tests. After Task 5, check by hand at League → Teams:

1. As a commissioner: the sidebar reads "Teams", the switcher lists every team,
   and it opens on your own team.
2. Switch to another team and change its TTS name and walk-up songs. Both persist
   after a reload — songs immediately, TTS on Save Team Profile.
3. Editing a team mid-change and switching away prompts before discarding.
4. As a plain member: sidebar still reads "My Team", no switcher, no Owner panel.
5. From the League roster, "Edit team" lands on that team in the editor.

## Known Risks

- `MyTeamForm.tsx` is already large and Task 5 grows it further. A split into
  `TeamProfileFields` / `TeamSongsPanel` / `TeamOwnerPanel` files is worth doing,
  but it is not bundled here — it would obscure the behavioral change under a
  large move diff.
- The dirty check covers text fields and pending uploads only. Editing a team's
  songs is always saved, so there is nothing to lose there, but the confirm text
  should not imply songs are at risk.
