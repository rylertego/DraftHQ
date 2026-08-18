# DraftHQ — Status & Handoff

> **This is the living status doc. Update it at task boundaries, not per commit.**
> Dated STATUS files are history only; this filename never changes so there is
> never a question about which one is current.
>
> Companions: [`deployment-runbook.md`](deployment-runbook.md) for infrastructure,
> and [`superpowers/plans/2026-08-13-global-visual-system.md`](superpowers/plans/2026-08-13-global-visual-system.md)
> whose checkboxes are the progress ledger for the visual-system work.

_Last updated: 2026-08-17._
_Everything is merged to `main`. No long-lived feature branch; work on short
branches off `main`. The `.worktrees/global-visual-system` worktree is stale._

> **Note on the previous doc's filename:** `STATUS-2026-08-06.md` is misdated. Its
> content was written on **2026-08-12**. The facts in it are correct; only the
> date in the name and its "verified live 2026-08-06" heading are wrong.

---

## Read this first

**Only one agent is active now.** Codex ran out of weekly quota mid-task on
2026-08-13 and has not returned; everything since is Claude's. Both agents'
commits carry the same git identity (`Tyler`), so authorship cannot be read
from `git log`. The commit-message style separates them:

| Style | Author | Example |
| --- | --- | --- |
| Sentence case, descriptive | Claude | `Show a real screen when a league is not yours to see` |
| lowercase imperative, short | Codex | `tighten league teams table layout` |

**If a second agent ever runs again, the hazard is concurrent edits to the same
files.** It never produced a conflict, but both agents independently started on
the My Team page in one session, and several fixes here were regressions caused
by one agent restructuring what the other had just shipped. Check `git log` and
the working tree before opening a file.

**Codex's own planning artifacts are in the repo** and are the authority on the
visual-system work:

- `docs/superpowers/specs/2026-08-13-global-visual-system-design.md` (546 lines)
- `docs/superpowers/plans/2026-08-13-global-visual-system.md` (1094 lines,
  120 checkbox tasks across 9 phases; Phases 0-3 complete, Task 10 done and
  Task 11 partway — see its Progress block)

Claude cannot see Codex's session, reasoning, or subagents — only what Codex
writes to disk or git. The reverse is presumably also true. **Anything one agent
needs the other to know has to land in a file.**

---

## 2026-08-17 — brand, accent migration, and Phases 2–4

Thirty commits. Three bodies of work: the cyan rebrand finished end to end, the
visual-system plan advanced from mid-Task-8 to mid-Task-11, and a handful of
bugs found by looking at the running app rather than by the test suite.

### Brand is now one value in one place

The logo is vector. Four SVGs replaced seven hue-shifted PNGs, and
`scripts/generate-brand-components.mjs` turns them into React components whose
fills read `--color-league-accent`. `FILTER_MAP` — ten hand-calibrated
`hue-rotate` values — is deleted. Accents are now exact rather than approximate:
setting `#ef4444` renders `rgb(239,68,68)`, where rotation could only land near
it.

**150 hardcoded teal sites are gone.** `grep -roE 'teal-[0-9]{2,3}' src/` returns
0. The only old-brand hex left is the "Teal" swatch in `COLOR_PAIRS`, which is a
colour a commissioner can pick. `scripts/migrate-accent.mjs` is kept as the
record of which file got product scope and which got league scope.

Three things that sweep found which a blind replace would have broken:

- The four confirmation banners were **success** styling that merely matched the
  old accent. They use `--color-success-*` now; cyan would have made every
  "Saved!" read as brand.
- `globals.css` still had `--primary: #14B8A6` as a legacy alias with two live
  usages.
- `WorkspaceLayoutClient` fell back to `"#14B8A6"` for leagues with no colour
  set, so **every themeless league rendered old-brand teal**.

`emailTemplates.ts` deliberately keeps inline hex — mail clients have no CSS
variables — so only its value changed.

### Four bugs that passed every automated check

Worth listing together, because the pattern is the point. Typecheck, 215 tests
and a clean production build were green for all four.

1. **13 of 15 lockup gradients painted nothing.** Inlining namespaced every
   gradient `id` with `useId()`, but those gradients inherit their stops via
   `xlink:href="#linear-gradient"` and those references still pointed at the old
   id. A dangling href is not an error — it paints emptiness. The HQ and "WIN
   FOREVER." simply vanished.
2. **Half the palette lost the mark's gradient.** The dark stop came from
   `--color-league-accent-border`, which only darkens accents already bright
   against the canvas. For Royal, Violet, Crimson, Rose and Indigo it returned
   essentially the base colour, so both stops matched and the shield rendered
   flat. The dark stop is now 62% of the accent over black.
3. **The dashboard three-dot menu navigated instead of opening.** The row is a
   `role="link"` div; the menu called `preventDefault()` without
   `stopPropagation()`. Those do different things — the first cancels the default
   action, the second stops the bubble. Menu opened and row navigated in one
   gesture.
4. **Every portalled dialog lost its league accent.** `Dialog` portals into
   `document.body`, outside `LeagueThemeScope`, so `--color-league-accent`
   resolved from the root fallback. Save Changes rendered cyan inside a
   Royal-accent league. `LeagueThemeScope` now mirrors its properties onto
   `:root`.

> **A custom property resolves the `var()`s inside it at the element where it is
> declared.** One defined at `:root` computes once against the root value and
> children inherit that frozen result. This cost an hour on the gradient work —
> the tidy `--…-deep` token silently produced identical stops for every accent.

### Two design-system gaps, both found by using it

- **No quiet-destructive variant.** `variant="danger"` is a solid fill. Using it
  for the Reset Draft trigger put a loud red block in the command center header
  beside Enter Draft Room, overstating an action nobody should be drawn toward.
  That trigger keeps a hand-rolled outline until a danger-ghost variant exists.
  Solid danger *is* right inside a confirmation dialog, where emphasis is the
  point.
- **Inconsistent destructive gating.** Delete league and delete account both
  require typing a confirmation. Delete *team* is one click behind a kebab —
  the one most likely to be hit by accident.

### Shipped alongside

Privacy policy at `/privacy`, written from the actual data flows rather than a
template, plus a `SiteFooter` so it is reachable at all. Account deletion is
live end to end: `delete_my_account()` clears app data first and the route
deletes the auth user second, because deleting the login first would strand the
data. League deletion added to league settings, owner-only, matching the RPC's
own permission rule.

Migration history and schema were realigned — five migrations had been applied
through the dashboard and never recorded. **Applying SQL through the Supabase
dashboard is what caused both migration problems this week.** Use `db push`.

### Verification debt, stated plainly

Signed-in verification in real Chrome covered: dashboard (empty and populated),
profile, create draft, create league, league workspace, teams table, and the
Reset / Edit Team / delete-league dialogs.

**Not verified, and it matters:**

- **Mobile, at all.** Deferred by decision, not oversight — recorded in the plan.
  A mobile pass over the whole league workspace is owed before release.
- **Roles other than commissioner** in the migrated league workspace.
- **The team delete confirmation.** `ConfirmDialog` confirms on one click with no
  typed gate, and this is a live league with ten real teams.
- **The import modal preview**, which needs a real provider league id and a
  write.

---

## Visual system execution — where it actually is

**It is all on `main` now.** The visual-system branch was merged, so
`.worktrees/global-visual-system` is no longer where work happens — continue on
branches off `main`. That worktree existed to isolate from a second agent that
is no longer running.

Progress lives in the plan's checkboxes and its Progress block, which are now
maintained. Historically they were not, and a session concluded the plan had
never been started because it read the main checkout while the work sat in a
worktree. If something looks missing, run `git worktree list` before concluding
anything.

Completed and independently reviewed (13 commits):

| Task | Commits | What |
| --- | --- | --- |
| 1 | `abc13bb` `a2be09d` | Baseline ledger + 22 normalized captures (this is Phase 0) |
| 2 | `83d337b` +2 fixes | Semantic accent derivation (`src/lib/uiColor.ts`) |
| 3 | `8ec5c02` `968b0ee` | Semantic tokens, legacy aliases preserved |
| 4 | `6f32b3a` `7a03aa0` | Layout + action primitives |
| 5 | `ab0ddaf` +3 fixes | Forms, navigation, feedback, overlays, identity |

Each went implement → independent review → fix rounds. Task 2 caught a contract
bug before it reached CSS; Task 3 caught semantic accent inheriting legacy teal;
Task 5 needed three rounds on overlay focus behaviour.

**Phases 0-3 are complete and Phase 4 is underway.** Task 6 (global chrome),
Task 7 (auth routes), Task 8 (home/dashboard/profile/join/creation/import),
Task 9 (league workspace shell) and Task 10 (league home + command center) are
done. Task 11 has its Add Team, delete-confirm and Edit Team overlays migrated;
the teams data surface itself and mobile presentation remain.

- `14328ec` — `LeagueAccessDenied` → PageShell/Panel/EmptyState/InlineNotice
- `cdc4ae3` — `AccountNav` → shared `Menu` + LinkButtons
- `f4fc6d2` — `LeagueInvitationInbox`, plus `mail` and `badgeCount` added to the
  overlay trigger contract. The inbox could not be expressed otherwise: its
  trigger is an icon carrying an unread count, and `TriggerVisual` was a closed
  three-icon contract. `badgeCount` is a number, not a node, so the
  closed-trigger guarantee still holds.
- `layout.tsx` **needs no migration.** It is `html`/`body`/providers/`AccountNav`
  with no visual surface of its own. The earlier stalled agents produced only
  line-ending changes there, which is consistent with that. Do not manufacture a
  diff for it.

Browser QA has run against the real app: the account menu opens, renders
Profile / Dashboard / Log Out, and dismisses on Escape with `aria-expanded`
returning to `false`. The invitation trigger renders its badge.

### Colour and badge policy (spec amended, then corrected)

Status — readiness, counts, lifecycle labels — renders in plain foreground text.
Colour is reserved for destructive/error, live draft state, the league accent,
and **identity/role**.

The first pass of that amendment also stripped colour from roles. That was an
over-correction and is reverted: role colour marks *who someone is*, does not
change moment to moment, and never becomes wallpaper the way tinted status did.
The lever for roles is the **badge budget — fewer of them, not greyer ones**.

**Trap that cost an hour:** after the merge the dev server served a stale CSS
bundle across three restarts — byte-identical hash, missing every `ui-*` rule,
making the primitives look broken. Source and `.next/static` were both correct;
it is Turbopack's persistent cache. Stop the server, then
`Remove-Item -Recurse -Force .next`, then restart. Worth doing after any large
merge rather than trusting a restart.

### Accent migration — DONE (2026-08-17)

All 150 sites migrated. `grep -roE 'teal-[0-9]{2,3}' src/` returns **0**, and the
only old-brand hex left is the "Teal" swatch in `LeagueSettingsForm`'s
`COLOR_PAIRS` — a colour a commissioner can deliberately pick, not brand drift.
Cyan `#22D3EE` is already in that palette too.

Done by `scripts/migrate-accent.mjs`, kept in the repo as the record of which
file got which scope. Translucent shades became `color-mix(... , transparent)`
because Tailwind arbitrary values cannot carry a `/opacity` suffix on a `var()`;
all ten generated rules were confirmed present in the built CSS.

Three things the sweep found that a blind replace would have broken:

- The four confirmation banners were success styling that merely matched the old
  accent. They now use `--color-success-*`. Making them cyan would have turned
  every "Saved!" into a brand element.
- `globals.css` still had `--primary: #14B8A6` as a legacy alias, with two live
  usages. It now points at the product accent.
- `WorkspaceLayoutClient` fell back to `"#14B8A6"` when a league had no colour
  set, so themeless leagues rendered old-brand teal. Now `DEFAULT_ACCENT`.

`emailTemplates.ts` deliberately keeps inline hex — mail clients have no CSS
variables — so only its value changed, to `#22D3EE`.

### Original scope notes (kept for context)

The brand moved from teal `#14BBA6` to cyan `#22D3EE`. All seven branding
PNGs were hue-rotated to match (`7f02477`) and the landing page was migrated
(`c756138`). **127 hardcoded `teal-*` Tailwind classes remain across 16 files.**
They must all go, but not all to the same place — this is the part that makes
it more than find-and-replace:

**→ `--color-product-accent` (app chrome, auth, account):**

| File | Count |
|---|---|
| `src/app/dashboard/page.tsx` | 15 |
| `src/app/teams/TeamSetupForm.tsx` | 12 |
| `src/app/signup/page.tsx` | 5 |
| `src/app/profile/page.tsx` | 5 |
| `src/app/forgot-password/page.tsx` | 5 |
| `src/app/create/page.tsx` | 4 |
| `src/app/reset-password/page.tsx` | 3 |
| `src/app/login/page.tsx` | 3 |
| `src/app/join/JoinDraftForm.tsx` | 3 |
| `src/app/leagues/new/page.tsx` | 1 |
| `src/app/privacy/page.tsx` | 1 |

**→ `--color-league-accent` (inside a league, must honour its chosen accent):**

| File | Count |
|---|---|
| `src/app/draft/DraftRoom.tsx` | 15 |
| `src/components/DraftChat.tsx` | 5 |
| `src/components/DraftBoard.tsx` | 2 |
| `src/components/LeagueCommandCenter.tsx` | 1 |
| `src/components/DraftLobby.tsx` | 1 |

**The rule:** anything rendered inside a league — draft room, board, chat,
lobby, command centre — takes the league's selected accent, so a league that
picked its own colour keeps it. Everything outside a league takes the product
accent. `--color-league-accent` already falls back to
`--color-product-accent` in `globals.css`, so leagues with no custom accent
land on cyan automatically; do not hardcode cyan in league surfaces or you
break the ones that chose a colour.

**Watch for:** `LinkButton`/`Button` deliberately reject `className` — use
`variant`, `scope`, and `fullWidth`, and put spacing on a wrapper. `scope="league"`
is the league-accent switch. Migrating buttons to the primitives is preferable
to swapping the colour literal in place.

**Not a blind sed.** Some `teal-*` uses are semantic success/confirmation
styling (e.g. the green-ish confirmation banners on Profile), not brand accent.
Those should become a success token, not the brand cyan. Check each one.

**Second population: 25 hardcoded hex literals** (`#14b8a6`, `#14bba6`,
`#2dd4bf`, `#0d9488`) that the class sweep will not catch — 8 in
`DraftRoom.tsx` alone (confetti, staged-player border, pick button), plus
`DraftAwardsCeremony`, `LeagueWorkspaceHeader`, `DraftTicker`, `DraftOrderRace`,
`DraftGradesBoard`, `DraftBoard`, `TeamSetupForm`. **150 sites in total.**
`emailTemplates.ts` (3) is the exception: inline hex is correct there, since
mail clients do not support CSS variables — update the value, keep the literal.

**How this class of bug hides.** `DEFAULT_ACCENT` in `LeagueThemeContext` was
still the old teal and was rotating the new cyan logo *back* to teal
(`32c1401`). It survived because under the old filter map the teal entry was a
no-op — a stale default and a correct one produced identical pixels. Any
hardcoded brand colour is invisible until the brand moves. Assume more of these
exist; grep for hex, not just classes.

### Inline the SVGs and delete FILTER_MAP (do this before the sweep)

`DraftHQLogo` recolours the mark per league accent with `hue-rotate`, and that
exists purely because `<img src="…svg">` is opaque to the parent document — CSS
cannot reach inside it. The filters are approximations: they rotate *every*
hue proportionally, cannot hit an arbitrary target exactly, and need
recalibrating whenever the source art changes (as they did in `d357aa6`).

Now that real vector source exists, inline the SVGs as React components and
replace their fills with `var(--color-league-accent)`. That gives exact accent
colours instead of approximations, works for any colour rather than the ten
enumerated ones, and **deletes `FILTER_MAP` entirely** along with the
recalibration hazard.

One wrinkle: the mark is a gradient (`#00E6F9` → `#00889A`), not a flat fill,
so the stops need deriving from the accent. `deriveAccentTokens` already
produces `base`/`hover`/`muted` and can feed them; `color-mix()` is the
alternative. Keep `<img>` for email — inline SVG is not safe there.

**Open colour drift:** the new SVGs are `#00E6F9`; `--color-product-accent` is
`#22D3EE`. Close but not identical, and the SVG is more saturated. Pick one and
move the other, or the logo and the buttons stay subtly different cyans.

### Two things that will bite whoever continues

**Primitives omit `className`, `style`, and `color`.** That is the Task 4
protected-token contract, not an oversight. Migrating a component means deleting
its local class constants, not re-expressing them. If you find yourself wanting
an escape hatch, the primitive is missing a prop — add it there.

**Draft settings pins its League Command bar at `top-[113px]`** against
`AccountNav`'s height (logo `h-24` 96px + `py-2` 16px + 1px border). The header
shell was left untouched in slice 2 for exactly this reason. When the shell is
retokenised, that literal must become a shared layout variable or the bar will
silently misalign — it will still *pin*, just behind or below the header, which
looks like "sticky is broken" rather than "the offset is stale".

**Browser QA for Task 6 is done** — see above. It only became possible once the
work was on `main`: `preview_start` resolves `.claude/launch.json` from the
primary working directory and cannot set a cwd, so it will not serve a worktree
while port 3000 runs the main checkout. Verify from `main`, not from a worktree.

---

## Current state

**Everything is merged to `main` and pushed.** There is no long-lived feature
branch any more: `feature/owner-team-experience` and
`feature/global-visual-system-execution` are both in, and the worktree at
`.worktrees/global-visual-system` is stale. Work on short branches off `main`.

Rollback tags, newest last: `pre-design-system`, `pre-owner-experience`,
`pre-visual-system`. Each large merge used `--no-ff`, so
`git revert -m 1 <sha>` undoes one wholesale.

**The real mock draft has still not been run.** It was the gate on the
design-system merge, which shipped anyway, so it now gates live code rather
than a branch. It remains the single largest piece of unverified risk.

### The dashboard pass (2026-08-16)

A long back-and-forth reshaped `LeagueCommandCenter`, which lost roughly 200
lines while gaining the owner view. The principles, because they will be
re-litigated otherwise:

- **Status is words, not colour.** Colour is reserved for destructive/error,
  live draft, the league accent, and identity/role.
- **One solid accent button per surface**, hollow neutral for the rest. If
  several are solid, none is primary.
- **Primary buttons use the league accent**, derived through
  `deriveAccentTokens` so the foreground stays readable for any league colour.
  Hardcoding `text-white` breaks whoever picks yellow.
- **A badge marks an exception.** If every row has one it is a column.
- **No grey eyebrow above a white heading** — it was a second, quieter title.
  The year folds in: "2025 League Standings".
- **Both roles render the same shapes** and differ only in permissions.

Gone entirely: readiness percentages, the readiness checklist panel, status
pills that repeated the tile below them, and narrated summary lines telling a
commissioner to do what the adjacent button does.

> **`ownerName` is where owner truth lives for imported leagues.**
> `ownerDisplayName` is only set when the person has a linked DraftHQ account.
> Sleeper imports fill `ownerName`, and in a league nobody has signed up for
> yet that is the only name there is.
>
> Found twice, in the same day. The champion card rendered blank for almost
> every team (`c060b00`). The **League teams page reported 7 of 10 teams as
> "Unassigned" when all ten have owners** (`30c48a3`) — and because that page
> was read as evidence the data was missing, it made the champion bug look
> like correct behaviour. Two wrong surfaces confirming each other.
>
> **Sleeper import is the main onboarding path, so every imported league looks
> like this.** When adding any owner display: read `ownerDisplayName ??
> ownerName`, and keep `ownerUserId` for *permissions* only — "has a linked
> account" and "has an owner" are different questions.

**Verification gate:**

```bash
npm run typecheck && npm run test:unit && npm run build && npm run lint:errors
```

At Claude's last run: typecheck clean, **164 tests**, build clean. `lint:errors`
reports **8 pre-existing** `react-hooks/set-state-in-effect` violations and exits
non-zero at that baseline — check the count, not the exit code. Any 9th is yours.

---

## Owner experience — what shipped

Requested: a My Team page for every owner (name, logo, walk-up songs), songs
carrying into the draft, owners exiting the draft room to the league dashboard,
a real screen for users without league access, and an always-visible way out of
draft settings.

### Done by Codex

**My Team page** (`/leagues/[slug]/my-team`) with name, short name, owner name,
logo, owner photo, and walk-up songs via `SongPicker`.

Codex independently found and fixed a bug Claude had also identified: the page's
save was a **direct `league_teams` table update**, but the only UPDATE policy on
that table is `is_league_commissioner(league_id)`. RLS filters the row out for an
owner, and a filtered UPDATE affects **zero rows without raising an error** — so
the form reported success and wrote nothing. Every owner, silently.

The fix is a security-definer RPC, `update_my_league_team`, so an owner can edit
their own team's fields and nothing else. RLS cannot restrict columns, and a
blanket owner-UPDATE policy would have let owners reassign ownership or unarchive
themselves.

**Walk-up songs now have a durable home.** They previously existed only on the
draft `teams` table, so they could not exist before a draft and did not survive a
season. `league_teams.walk_up_songs` is now the owner-facing source of truth.

**The per-draft override is implemented as specified** — the product decision was
that an owner's picks are the durable default and a commissioner's draft-settings
edits apply to that draft only:

```sql
walk_up_songs = case
  when t.walk_up_songs_overridden then t.walk_up_songs
  else new.walk_up_songs
```

`update_team_details` sets `walk_up_songs_overridden = true` when a commissioner
writes songs from draft settings, and a backfill marks existing draft songs as
overridden so the migration does not clobber them.

Migrations `20260812000000_owner_team_profile_defaults.sql` and
`20260812001000_owner_photo_profile_default.sql`. **Both verified deployed** —
`league_teams.walk_up_songs`, `league_teams.owner_photo_url`, and the
`update_my_league_team` function all exist in project `kogyejhzzggrkekbcppm`.

### Done by Claude

**Member settings and Leave League** (`0200425`). Members had no settings at all
— the nav entry was gated on `canManage` — and no way to exit a league, because
`league_members` DELETE is commissioner-only. Migration
`20260816000000_leave_league.sql` adds a security-definer RPC rather than a
broader RLS policy, so the exit stays narrow: it deletes exactly the caller's own
row, releases any league team they held so the franchise returns to unassigned,
and refuses for the league owner, who would otherwise orphan the league.
`SettingsRouter` picks the view by role. **Migration confirmed deployed by the
user.**

**Invitation reuse** (`4599282`). Revoking sets `status = 'revoked'` rather than
deleting, but the re-invite lookup matched only `'pending'`, so invite → revoke →
re-invite piled up a new row each cycle. It now matches either and takes the most
recent. Same commit removed the duplicate Edit button on the teams page.

**Members list** (`9b32bb5`, `df83456`, `3955a95`). Ordered by authority —
commissioner, co-commissioners, members — with display name as a stable tiebreak;
the API returns join order, which read as arbitrary. Role is a right-aligned
column with uniform treatment, not a pill on some rows and bare text on others.
The self "Edit profile" button and its modal are gone (172 lines): My Team
already owns that job.

> Alignment there was broken by each row being **its own grid**, so a trailing
> `auto` column sized per row — 0px without an action, ~110px with one — and
> dragged the role column around. Grid columns only align within one grid. A
> fixed track fixed it. This is invisible in source and only shows in a browser.

**Lobby Back button** (`a75319c`). `DraftLobby`'s `backHref` was hardcoded to
`/teams?tab=settings` for everyone. The lobby is exactly where owners land from
"Enter Draft Room", so every owner hitting Back was dumped into commissioner-only
draft settings. Non-managers now go to the league dashboard.

**Sticky "League Command" button** (`a75319c`). Draft settings is a long page and
the way out sat at the top of the scroll. That row is now `sticky top-0` with
negative margins so its backdrop spans the container padding. Nothing in the
ancestor chain establishes a scroll container that would break it.

**League access-denied screen** (`58dedbc`). Visiting `/leagues/{slug}` without
access rendered the full workspace chrome around a generic red error box with a
Try Again button that could never succeed.

RLS on `public.leagues` is `is_league_member(id)`, so a non-member's SELECT
returns **zero rows rather than a permission error**, and `.single()` fails with
`PGRST116`. **A league you cannot see and a league that does not exist are
therefore indistinguishable.** That is the correct privacy behaviour, so both
land on the same screen rather than confirming a league exists — and the screen
shows no league name, logo, or accent colour, since echoing branding back to a
non-member would leak exactly what the policy protects.

- `src/lib/leagueAccess.ts` classifies failures as `signed-out` / `no-access` /
  `error` as pure logic, 5 tests
- `WorkspaceLayoutClient` renders the screen in place of the chrome, so every
  `/leagues/[slug]/*` route is covered, not just the dashboard

Verified in a browser as an unauthenticated visitor against both a real league
slug and a nonsense one: identical screen, both buttons resolve, no console
errors.

### Not done, by decision

A distinct commissioner/co-commissioner dashboard. `canManage` already covers
both roles (`leagueApi.ts:311`), and the owner dashboard shipped 2026-08-12. The
call was that the commissioner view is fine as-is.

---

## Spotify — how it actually works

This was a standing misconception worth recording. It is **not** one shared
Spotify account.

- **One app registration** (`SPOTIFY_CLIENT_ID`/`SECRET`) — the only shared part.
- **Search uses client credentials.** `/api/music/spotify-search` gets an
  app-level token, so **any owner can search and pick songs without connecting a
  Spotify account at all.** The My Team page needs no connect flow.
- **Playback uses each user's own OAuth token** (`scope=streaming ...`) via the
  Web Playback SDK. That scope **requires Spotify Premium**, and the token
  belongs to whoever connected *on that device*.
- **YouTube is the fallback** — `WalkUpPlayer` uses `youtubeTrackId` when no
  Spotify device is available.

Practically: on draft night the music comes out of the host/TV device using
whichever Spotify account is connected there. Owners picking songs on phones need
nothing.

---

## Draft grading — fixed, but not yet trusted

Grading had **never run against a realistic draft** before 2026-08-12. Every
"complete" draft in production is a 2–4 team, 2–3 round toy with 4–12 picks. This
is still true: **no real draft has ever been graded.**

Simulating a full 10-team, 15-round draft off the real 2026 ESPN board exposed
three defects, all now fixed:

**1. Every WR and TE was mislabeled** (`24d9c02`). `ESPN_POS` mapped `3 -> TE` and
`4 -> WR`; ESPN's real ids are `3 = WR`, `4 = TE`. The entries were listed out of
numeric order (`4: "WR", 3: "TE"`), which is what disguised it — read left to
right it looks correct. Puka Nacua came back as a TE and Travis Kelce as a WR.
Rankings were resynced for 2026 and 2025, plus 36 rows repaired by hand for
players ESPN had dropped from its feed (an upsert can never reach those).

**2. Kickers and defenses won the draft** (`aaa68f5`). K/DST took 13 of the 20
best picks with five A grades in round 14. Two stacked causes: `NO_RANK_MARKET`
only suppressed the *rank* basis on the assumption that "real ADP handles them
fine" — so the guard silently deactivated the moment ADP landed in the table. And
suppressing value alone made it *worse*, because the 0.4 weight redistributed
onto factors that are degenerate for these positions (quality is measured within
position, so the best remaining kicker scores ~96 by construction). Late K/DST
picks are now compressed toward neutral. K/DST share of the top 20: **13/20 → 0/20**.

**3. Draft scheduling ignored the selected timezone** (`44e892a`), in both
directions — the write interpreted input in the browser's zone, and the read
sliced the ISO string in UTC, so 7:00 PM Eastern reloaded as 23:00. New
`src/lib/draftSchedule.ts` derives offsets from `Intl`, resolving in two passes so
times near a DST boundary land on a real instant. 11 tests including a round-trip
across all nine zones the picker offers.

### Still open on grading

**ADP tail saturation.** 73.7% of players with ADP sit in the 160–171.6 band —
the distribution is nearly a point mass at the cap. The sync's degenerate-spread
guard counts *distinct values* (302 easily clears its threshold) rather than
checking distribution shape, so it passes while the tail is censored. This is
what made late skill picks read as huge reaches. Fix belongs in the guard or in
how the grader normalizes ADP against draft size.

**Construction factor contributes no signal** — flat at 94 across all ten teams
in simulation.

**No A grades reachable in simulation.** Top pick capped at B+ after the K/DST
fix. This may be an artifact of the simulation drafting close to ADP (producing
no genuine steals) rather than a grader defect. Unverified either way.

The simulation harness is not in the repo. It lives in a scratchpad and would need
rebuilding; it is worth making a permanent `scripts/` tool, since it is the only
thing that has ever exercised grading end to end.

---

## Deployment — verified 2026-08-13

Probed directly against project `kogyejhzzggrkekbcppm`.

| Item | Status |
| --- | --- |
| `walk_up_music_mode`, `awards_song`, `adp`, `projected_points` | present |
| `announcer-clips`, `draft-videos`, `league-assets`, `league-team-logos` buckets | exist |
| `league_teams.walk_up_songs`, `.owner_photo_url` | present |
| `update_my_league_team` RPC | present |
| 2026 + 2025 rankings, correct positions | resynced |

> **`supabase_migrations.schema_migrations` is empty.** Every migration was
> applied via the SQL editor, so `list_migrations` reports nothing and the CLI
> would think the database is virgin. **Verify deployment by probing for columns,
> functions, and buckets — never by trusting that table.** Do not run
> `supabase db push` against this project without thinking hard first.

---

## Known gaps

**The real mock draft has never been run.** It gates the `main` merge, the
grading fixes, the owner dashboard, and the My Team page. Nothing below replaces it.

**Mobile is unverified across the whole app.** Deferred by decision on
2026-08-17, not overlooked. The league workspace shell, every Phase 4 surface
and all migrated dialogs have only been seen at desktop width. This is now the
largest untested surface after the mock draft.

**Two destructive-action inconsistencies.** Delete team is one click behind a
kebab menu, while delete league and delete account both require typing a
confirmation — the team one is the likeliest accidental hit. And the design
system has no quiet-destructive variant, so the Reset Draft trigger carries a
hand-rolled outline rather than the solid `variant="danger"` fill.

~~**The owner save path is unverified end to end.**~~ **Verified 2026-08-16.**
Signed in as a real non-commissioner owner, typed into Short Name, saved, and
confirmed the row changed in the database, then reverted it. The silent-write
bug is genuinely dead.

**Leave League is partly verified.** A real member left a league on production
and the site behaved: they lost league access, and the draft room refused them.
**Both migrations are deployed** — `20260816000000_leave_league.sql` and the
follow-up `20260816010000_leave_league_full_cleanup.sql`.

Two things still unconfirmed, both cheap and worth doing as commissioner:

- **The members list shows 2 people**, not 3.
- **Trap Queens reads Unassigned** on the League page. This is the part of the
  RPC most likely to have silently no-opped, and it matters: an unreleased team
  cannot be handed to a replacement owner.

> The draft-room denial did **not** prove participant cleanup works. That user
> had never joined the draft, so `can_view_draft` failed on both branches for
> the ordinary reason. The follow-up migration clears `draft_participants` and
> `league_team_seasons.owner_user_id` anyway, because the hole is real for
> anyone who *has* been in a draft — but it has not been exercised. To test
> properly: join a draft, then leave the league, then reopen the lobby link.

**Commissioners must re-upload their league logo once.** The `league-assets`
bucket never existed, so uploads silently fell back to a 256px base64 data URL in
`leagues.logo_url`. That is the real cause of blurry logos on the TV. The stored
value is already downsampled and the original is gone, so only a fresh upload
fixes it. Confirm the saved URL looks like
`…/league-assets/{leagueId}/logo.ext?v=…` and not `data:`.

**Other standing items:** 8 deferred lint errors, no rate limiting on public
endpoints, Spotify tokens in localStorage, manually-created drafts still have no
declared starting lineup (the grader infers one and labels it assumed), AI
announcers disabled behind `NEXT_PUBLIC_AI_ANNOUNCER_ENABLED`.

---

## Architecture notes worth knowing

**Silent failures are this codebase's characteristic bug.** Three found in two
days, all the same shape: a `catch {}` or an RLS-filtered write that reports
success and does nothing — the missing `league-assets` bucket, the owner's My Team
save, and the K/DST guard that deactivated when its data arrived. **Prefer failing
loudly where a user can see it.** When you add a fallback, ask what it hides.

**Storage path conventions are load-bearing.** RLS policies parse the object name
with `storage.foldername(name)[1]::uuid`, so the first path segment must be the
owning entity's UUID. `league-assets` → `{leagueId}/{type}.{ext}`; league team
logos → `{leagueId}/{teamId}/...`; draft team assets → `{draftId}/{teamId}/...`;
draft audio → `{draftId}/...`. Changing a path format without changing its policy
silently breaks writes.

**RLS cannot restrict columns.** When a non-commissioner needs to edit *some*
fields of a row, the pattern here is a `security definer` RPC that checks
authority and writes a fixed column list — see `update_my_league_team`. Do not
reach for a broader UPDATE policy.

**`update_draft_extras` is recreated by several migrations.** Adding a parameter
means dropping and recreating the whole function and updating the `revoke`/`grant`
signatures. Prefer a **post-create update call** over a new RPC parameter where
you can — that is how the Create Draft date field avoided a migration entirely.

**Audio is the most fragile subsystem.** Playback position is **derived**, never
stored — every client computes the same answer from pick timestamps, which is why
walk-up music stays in sync. One `walkUpDelayRef` timeout slot; every transition
clears it before scheduling. Reveal and landmine ownership is enforced at **fire
time** inside delayed closures, not at schedule time. `WalkUpPlayer.play()`
reloads from the top — never call it to "resume".

**Draft correctness lives in Supabase/Postgres.** React displays state; it does
not enforce draft rules. Do not use localStorage as authoritative draft state.

---

## What's next

1. **Run the real mock draft.** It gates everything above. While drafting, check:
   the owner dashboard from a second non-commissioner account; a league logo
   re-upload producing a hosted URL; a draft date surviving a settings reload in
   the right zone; an owner saving My Team and the row actually changing; and no
   kicker topping the pick grades at the end.
2. **Finish the visual-system plan** —
   `docs/superpowers/plans/2026-08-13-global-visual-system.md`. Phases 0-3 are
   complete; resume at **Task 11 Step 2** (the teams data surface). Draft
   Settings — the screen most visibly inconsistent with the rest of the site —
   is Tasks 16-17, has no hard dependency on Tasks 12-15, and can be pulled
   forward if it starts to grate.
3. **ADP saturation.** Replace the distinct-value guard with a distribution-shape
   check, or normalize ADP against draft size in the grader.
4. **Export / sync back to Sleeper** — still the biggest strategic gap. The
   companion thesis is import → great draft night → back to your platform, and
   only a CSV download exists.
5. **Smaller:** make the draft simulation a permanent `scripts/` tool; grader v2
   construction penalty; `league_events` table so League Activity shows leaves as
   well as joins; logo-dimension warning on upload (now worth doing, since logos
   are finally stored at full resolution); transactional email.
