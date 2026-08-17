# DraftHQ Global Visual System Implementation Plan

## Progress

> **Keep this block and the checkboxes current as tasks complete.** They were
> not maintained for the first five tasks, and the result was a session that
> read the main checkout, saw unchecked boxes and no `src/components/ui/`, and
> concluded the plan had never been started — when Tasks 1–5 were done in a
> linked worktree. Commit history is the fallback record; these boxes should be
> the primary one.

**Everything is on `main`.** The visual-system branch has been merged; continue
on branches off `main`. The `.worktrees/global-visual-system` worktree existed
to isolate from a second agent that is no longer running, and is now stale.

| Phase | Tasks | State |
| --- | --- | --- |
| 0 — Baseline Contract | 1 | ✅ Complete |
| 1 — Shared Foundation | 2, 3, 4, 5 | ✅ Complete |
| 2 — Global Product Surfaces | 6 | ✅ Complete |
| 2 — Global Product Surfaces | 7, 8 | ⬜ Not started |
| 3–8 | 9–… | ⬜ Not started |

**Task 6 is being done in slices**, because the original full-scope attempts
stalled. Steps below are left unticked until every slice lands:

- ✅ Slice 1 — `LeagueAccessDenied` (`14328ec`)
- ✅ Slice 2 — `AccountNav` (`cdc4ae3`)
- ✅ Slice 3 — `LeagueInvitationInbox` + `mail`/`badgeCount` trigger extension (`f4fc6d2`)
- ✅ Slice 4 — `layout.tsx` needs no migration: html/body/providers/AccountNav,
  no visual surface of its own. The stalled diff only had line-ending changes.
- ✅ Browser QA — run against `main` in a signed-in session. Account menu opens,
  renders Profile / Dashboard / Log Out, and dismisses on Escape with
  `aria-expanded` returning to `false`. Invitation trigger renders its badge.

> **If primitives look unstyled, suspect the dev server before the code.** After
> the merge it served a stale CSS bundle across three restarts — byte-identical
> hash, missing every `ui-*` rule. Source and `.next/static` were both correct;
> it is Turbopack's persistent cache. Stop the server, then
> `Remove-Item -Recurse -Force .next`, then restart.

**Baseline at last commit:** typecheck clean, 215 tests, production build clean.

### Done ahead of the plan (2026-08-16)

The league dashboard (Task 10's surface) was reworked directly, driven by the
user rather than by this plan, so Task 10 will find much of its work already
done. It does **not** use the `ui/` primitives yet — it still uses local classes
plus `deriveAccentTokens` for the accent — so the primitive migration is still
owed. What is already settled there, and should not be re-litigated:

- Status in words, not colour; colour reserved for destructive/error, live
  draft, league accent, identity/role
- One solid league-accent button per surface, hollow neutral for the rest
- No grey eyebrow above a white heading — the year folds into the heading
- Both roles render the same shapes, differing only in permissions

`LeagueMembers` was likewise reordered and de-badged (Task 13's surface).

> **Do not "restore" readiness percentages, status pills, or eyebrow prefixes**
> when migrating these routes to primitives. They were removed deliberately and
> at length.

**Draft Settings** (`/teams`, Tasks 16–17) had its own `N% Ready` badge removed
too (`6448e13`), so it does not contradict the dashboard while it waits its
turn. Everything else there is still unmigrated and visibly inconsistent by
design: its own hero, tab treatment, button classes, and a sticky bar pinned at
`top-[113px]` against `AccountNav`'s height. That literal is the thing to
convert to a shared layout variable during Task 16.

---


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one shared, semantic DraftHQ visual system and migrate every user-facing route without changing business logic, permissions, routing, or specialized draft workflows.

**Architecture:** Introduce semantic CSS tokens, deterministic product/league accent derivation, and focused React primitives alongside the current application. Legacy compatibility exports retain their existing rendered output until each consuming route deliberately adopts the new primitives. Migrate global surfaces, the league workspace, operational routes, draft configuration, and Draft Night surfaces in that order; each phase ends in a working, browser-reviewed commit before the next phase begins.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4/global CSS, Supabase, Vitest, Playwright, existing browser QA tooling.

## Global Constraints

- **Status is not conveyed by colour** (spec amended 2026-08-13). Readiness
  percentages, counts like "3/10 owners", lifecycle labels, and checklist items
  render in standard foreground text. Colour is reserved for destructive/error,
  live draft state, the league accent, and identity/role. Every route migration
  must strip semantic tinting from *status* text rather than port it forward.
  Roles keep their colour — the lever there is the badge budget, fewer of them.
- **Badge budget** (spec amended 2026-08-13). A badge marks an *exception*. If
  every row in a list has one, render a column instead. `RoleBadge` only on the
  members list for roles above `member`, and on draft-night surfaces where
  commissioner authority must be unmistakable. `StatusBadge` at most once per
  surface, on the single fact that governs what to do next.
- Use semantic `product-accent` terminology. The current DraftHQ blue/cyan brand color is only the implementation value.
- Inside a league workspace, primary operational actions use the accessible league accent. Global actions use the product accent.
- Destructive actions remain red. Secondary and tertiary actions remain neutral.
- Active league navigation, selected tabs, focus states, and important league highlights may use the league accent. Large backgrounds may not.
- Automatically derive accessible foreground, hover, muted, border, and focus values for very light, dark, or low-contrast league colors.
- Operations Mode defaults to compact density. Do not add decorative vertical expansion.
- Controls use a 4px radius, standalone object panels use a 6px radius, and overlays use 6-8px with 8px as the absolute maximum. Ordinary controls and panels must not drift back toward a rounded or card-heavy appearance.
- Operational page titles normally top out at 30px. Reserve 40px display typography for Draft Night and presentation surfaces.
- The 720px readable width is for forms and prose. Tables, standings, rosters, draft boards, team grids, and management views use the wider workspace.
- Preserve routing, permissions, database behavior, validation, draft logic, timer behavior, realtime behavior, audio behavior, and commissioner controls.
- Preserve the current Draft Room, Lobby, TV Mode, pick reveal, recap, and awards layout anatomy unless a demonstrated clipping, hierarchy, accessibility, or responsive defect requires a contained structural correction.
- Every phase must leave every touched route working and reviewable. Never commit a knowingly broken or partially functional route.
- Browser QA must compare migrated routes with their saved baseline captures for information hierarchy, content, state coverage, and workflow preservation.
- Do not add a major UI framework, icon package, component test framework, visual regression service, or testing dependency unless the existing stack cannot meet a documented requirement.
- Before editing any existing function, component, class, or method, run GitNexus upstream impact analysis and report the blast radius. Stop and warn before HIGH or CRITICAL-risk edits.
- Before every commit, run GitNexus `detect_changes({scope: "compare", base_ref: "main"})` and confirm only expected symbols and flows changed.
- Keep `.claude/settings.local.json` and `.codex-screenshots/` local-only unless already tracked intentionally.
- `CommandCenterUI` compatibility exports must preserve their existing visual output during foundation work. Each route migration replaces its own legacy imports with new primitives; the compatibility module is removed only after every consumer has been intentionally migrated.

---

## File Architecture

### New Shared Files

| File | Responsibility |
| --- | --- |
| `src/lib/uiColor.ts` | Parse league colors, calculate contrast, and derive accessible accent tokens without React or DOM dependencies. |
| `src/components/ui/types.ts` | Shared visual roles and density/width types. |
| `src/components/ui/Action.tsx` | `Button`, `LinkButton`, and `IconButton` with semantic intent, league/product scope, loading, disabled, and focus behavior. |
| `src/components/ui/Layout.tsx` | `PageShell`, `PageHeader`, `Section`, `Panel`, `DataSurface`, `FormLayout`, `SettingsShell`, and `WorkspaceToolbar`. |
| `src/components/ui/Forms.tsx` | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, and numeric stepper composition. |
| `src/components/ui/Navigation.tsx` | `Tabs`, compact segmented controls, and shared navigation state treatment. |
| `src/components/ui/Feedback.tsx` | `Badge`, `Alert`, `Progress`, `EmptyState`, `Skeleton`, and inline save/error state. |
| `src/components/ui/Overlay.tsx` | Accessible `Dialog`, `ConfirmDialog`, `Menu`, `Popover`, and `Tooltip` using the existing React stack and portals. |
| `src/components/ui/Identity.tsx` | `Avatar`, `TeamMark`, and `LeagueMark` with stable dimensions and fallbacks. |
| `src/components/ui/index.ts` | Public exports only; route code imports primitives from this boundary. |
| `tests/unit/uiColor.test.ts` | Deterministic accent derivation and contrast tests. |
| `docs/ui-audit/global-redesign-baselines.md` | Route/state/viewport baseline ledger and comparison notes. |

### Compatibility Boundary

`src/components/CommandCenterUI.tsx` remains temporarily and unchanged during the foundation phase. Its existing exports preserve their current markup, classes, and visual output so no route changes appearance before its intentional migration. Every route task must replace that route's `CommandCenterUI` imports with the new primitives. Remove the compatibility module only in the final convergence phase after `rg "CommandCenterUI" src` returns no consumers.

### Shared Interfaces

```ts
export type AccentScope = "product" | "league";
export type ActionIntent = "primary" | "secondary" | "tertiary" | "danger";
export type SurfaceTone = "default" | "raised" | "subtle" | "transparent";
export type Density = "compact" | "touch";
export type ContentWidth = "readable" | "workspace" | "full";

export interface AccentTokens {
  base: string;
  hover: string;
  muted: string;
  border: string;
  foreground: "#020617" | "#ffffff";
  focus: string;
}

export function deriveAccentTokens(
  input: string | null | undefined,
  fallback: string,
): AccentTokens;
```

`Button` and `LinkButton` select color from `intent` and `scope`; callers never pass a raw accent class. `scope="league"` consumes the CSS variables installed by `LeagueThemeContext`; outside that provider it safely falls back to product tokens.

```ts
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: ActionIntent;
  scope?: AccentScope;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

interface PageShellProps {
  width?: ContentWidth;
  density?: Density;
  children: React.ReactNode;
}
```

---

## Phase Gate Used After Every Migration Phase

Run these steps before the phase commit:

- [ ] Run `npm.cmd run typecheck`; expect exit code 0.
- [ ] Run `npm.cmd run lint`; expect exit code 0. This is intentionally stronger than linting only the changed files and avoids an ambiguous path list.
- [ ] Run `npm.cmd run test:unit`; expect all tests to pass.
- [ ] Run `npm.cmd run build`; expect the production build and route generation to succeed.
- [ ] Run `git diff --check`; expect no whitespace errors.
- [ ] Run GitNexus change detection against `main`; inspect every affected symbol and execution flow.
- [ ] Exercise every touched route and interaction in the authenticated or anonymous browser state it requires.
- [ ] Capture 1440x900 desktop and 390x844 mobile screenshots for operational routes; add 1366x768 and 1920x1080 for Draft Night routes.
- [ ] Compare new captures side-by-side with the baseline ledger. Record preserved content, hierarchy, controls, and states plus intentional visual changes.
- [ ] Confirm every intentionally migrated route imports the new primitives directly and no untouched route changed because of shared compatibility code.
- [ ] Verify keyboard navigation, visible focus, 44px mobile touch targets, zoom/reflow, reduced motion, and no horizontal clipping.
- [ ] Commit only after all touched routes are functional and reviewable.

If a phase reveals a functional defect unrelated to styling, stop that route migration, report it, and keep the last working phase commit intact.

---

## Phase 0: Baseline Contract

### Task 1: Record Route, State, and Screenshot Baselines

**Files:**
- Create: `docs/ui-audit/global-redesign-baselines.md`
- Inspect: `C:/Users/regot/OneDrive/Pictures/DraftHq Current PAges/`
- Write screenshots locally: `.codex-screenshots/global-redesign/baseline/`

**Interfaces:**
- Consumes: Existing application routes, authenticated session, existing screenshot archive.
- Produces: A committed ledger keyed by route, role, state, viewport, and local screenshot filename.

- [x] **Step 1: Inventory route states**

Use this exact ledger schema:

```md
| Route | Role | State | Viewport | Baseline file | Required content/actions | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| /leagues/[slug] | commissioner | draft scheduled | 1440x900 | dashboard-commissioner-scheduled-desktop.png | season, readiness, countdown, configure, enter room, standings, history | |
```

Include anonymous, commissioner, co-commissioner, assigned owner, unassigned member, empty, loading, validation error, save failure, destructive confirmation, active draft, paused draft, completed draft, and unauthorized states where supported.

- [x] **Step 2: Capture missing baselines**

Use 390x844 and 1440x900 for all operational pages. Use 1366x768, 1440x900, and 1920x1080 for Lobby, Draft Room, TV Mode, pick reveal, recap, and awards. Do not alter code to manufacture visual states.

- [x] **Step 3: Verify the ledger**

Run:

```powershell
rg "\| /" docs/ui-audit/global-redesign-baselines.md
git check-ignore .codex-screenshots/global-redesign/baseline/example.png
```

Expected: all user-facing route families appear; screenshot output is ignored.

- [x] **Step 4: Commit the baseline contract**

```powershell
git add -- docs/ui-audit/global-redesign-baselines.md
git commit -m "docs: record visual migration baselines"
```

---

## Phase 1: Shared Foundation

### Task 2: Build Accessible Accent Derivation Test-First

**Files:**
- Create: `src/lib/uiColor.ts`
- Create: `tests/unit/uiColor.test.ts`

**Interfaces:**
- Consumes: Hex colors from league branding and the product fallback token.
- Produces: `deriveAccentTokens(input, fallback): AccentTokens` and internal WCAG contrast helpers.

- [x] **Step 1: Write failing unit tests**

```ts
import { describe, expect, it } from "vitest";
import { contrastRatio, deriveAccentTokens } from "@/lib/uiColor";

describe("deriveAccentTokens", () => {
  it.each([undefined, null, "", "not-a-color"])("falls back for %s", (input) => {
    expect(deriveAccentTokens(input, "#22d3ee").base).toBe("#22d3ee");
  });

  it.each(["#ffffff", "#050505", "#777777", "#ffff00"])(
    "chooses readable text for %s",
    (input) => {
      const tokens = deriveAccentTokens(input, "#22d3ee");
      expect(contrastRatio(tokens.base, tokens.foreground)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("returns distinct hover, muted, border, and focus values", () => {
    const tokens = deriveAccentTokens("#7c3aed", "#22d3ee");
    expect(new Set(Object.values(tokens)).size).toBeGreaterThan(3);
  });
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `npm.cmd run test:unit -- tests/unit/uiColor.test.ts`

Expected: failure because `@/lib/uiColor` does not exist.

- [x] **Step 3: Implement the pure color module**

Implement strict `#rgb`/`#rrggbb` parsing, sRGB relative luminance, `contrastRatio`, bounded RGB mixing, and `deriveAccentTokens`. Select black or white foreground by the higher ratio; if neither reaches 4.5 after normalization, adjust the base toward the contrasting endpoint until it does. Do not access `window`, CSS, React, or Supabase.

- [x] **Step 4: Run the focused and full unit suites**

```powershell
npm.cmd run test:unit -- tests/unit/uiColor.test.ts
npm.cmd run test:unit
```

Expected: all tests pass.

- [x] **Step 5: Commit the color engine**

```powershell
git add -- src/lib/uiColor.ts tests/unit/uiColor.test.ts
git commit -m "feat: add semantic accent derivation"
```

### Task 3: Install Semantic CSS Tokens and League Theme Variables

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/context/LeagueThemeContext.tsx`
- Test: `tests/unit/uiColor.test.ts`

**Interfaces:**
- Consumes: `deriveAccentTokens`, current league primary/accent color.
- Produces: CSS variables for canvas, surfaces, borders, text, product accent, league accent, statuses, spacing, typography, radii, elevation, motion, and density.

- [x] **Step 1: Run GitNexus impact analysis**

Analyze `LeagueThemeProvider` upstream. Record callers and risk before editing. Treat HIGH or CRITICAL as a stop-and-report gate.

- [x] **Step 2: Add semantic token families**

Define the specification’s variables under `:root`, including these stable public names:

```css
--color-canvas;
--color-shell;
--color-surface-1;
--color-surface-2;
--color-surface-3;
--color-border-subtle;
--color-border-strong;
--color-text-primary;
--color-text-secondary;
--color-text-muted;
--color-product-accent;
--color-product-accent-hover;
--color-product-accent-foreground;
--color-league-accent;
--color-league-accent-hover;
--color-league-accent-muted;
--color-league-accent-border;
--color-league-accent-foreground;
--color-focus-ring;
--color-success;
--color-warning;
--color-danger;
--color-info;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--radius-surface: 4px;
--radius-control: 4px;
--radius-panel: 6px;
--radius-overlay: 8px;
--control-height-sm: 32px;
--control-height-md: 40px;
--control-height-touch: 44px;
```

Keep legacy variables only as aliases during migration. Remove global element selectors that force one-off input/button appearance only after the new primitives cover their consumers.

- [x] **Step 3: Expand `LeagueThemeProvider`**

Use `deriveAccentTokens` once per league color with `useMemo`. Install all league accent variables on the provider element. Set `--color-focus-ring` to league focus inside a league workspace and leave product focus elsewhere. Preserve current context values and behavior.

- [x] **Step 4: Verify token behavior**

Run typecheck, focused tests, build, and browser-inspect a very light, very dark, and default league color. Confirm text contrast and focus visibility without changing large surfaces.

- [x] **Step 5: Commit tokens**

```powershell
git add -- src/app/globals.css src/context/LeagueThemeContext.tsx tests/unit/uiColor.test.ts
git commit -m "feat: establish semantic visual tokens"
```

### Task 4: Build Layout and Action Primitives

**Files:**
- Create: `src/components/ui/types.ts`
- Create: `src/components/ui/Layout.tsx`
- Create: `src/components/ui/Action.tsx`
- Create: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: Semantic CSS variables and shared types listed above.
- Produces: `PageShell`, `PageHeader`, `Section`, `Panel`, `DataSurface`, `FormLayout`, `SettingsShell`, `WorkspaceToolbar`, `Button`, `LinkButton`, and `IconButton`.

- [x] **Step 1: Inventory `CommandCenterUI` consumers without editing compatibility exports**

Run GitNexus context/impact analysis and `rg "CommandCenterUI" src` to record every consumer. This inventory defines the route-migration checklist; do not edit `CommandCenterUI.tsx` in this task.

- [x] **Step 2: Implement the shared types and layout primitives**

Use compact defaults and these constraints:

```ts
const contentWidths = {
  readable: "max-w-[720px]",
  workspace: "max-w-[1600px]",
  full: "max-w-none",
} satisfies Record<ContentWidth, string>;
```

`PageHeader` permits title, eyebrow, description, identity, status, and actions without nesting a second card. `Panel` is for a discrete object/workflow and uses `--radius-panel: 6px`. `DataSurface` is for tables/grids and uses no more than the 4px standard framed-surface radius. `Section` defaults to unframed grouping with optional divider.

- [x] **Step 3: Implement action primitives**

Map semantic intent as follows:

```ts
primary + product -> product accent
primary + league  -> league accent
secondary         -> neutral raised surface
tertiary          -> transparent neutral
danger            -> danger family
```

Enforce stable heights, `--radius-control: 4px`, disabled semantics, `aria-busy` during loading, visible `:focus-visible`, icon-only accessible names, and at least 44px mobile touch targets. Do not accept raw color class props.

- [x] **Step 4: Prove foundation isolation**

Confirm `git diff -- src/components/CommandCenterUI.tsx` is empty. Render every existing `CommandCenterUI` consumer at its baseline viewport and verify there is no intentional visual change from introducing the new files and tokens. New primitives remain unused by legacy routes until their individual migration tasks.

- [x] **Step 5: Verify and commit**

Run the phase gate. Browser-check League Dashboard, Teams, Settings, and Draft Settings against their baseline captures to prove foundation work did not change their appearance.

```powershell
git add -- src/components/ui
git commit -m "feat: add shared layout and action primitives"
```

### Task 5: Build Forms, Navigation, Feedback, Overlay, and Identity Primitives

**Files:**
- Create: `src/components/ui/Forms.tsx`
- Create: `src/components/ui/Navigation.tsx`
- Create: `src/components/ui/Feedback.tsx`
- Create: `src/components/ui/Overlay.tsx`
- Create: `src/components/ui/Identity.tsx`
- Modify: `src/components/ui/index.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: Shared semantic tokens, action primitives, React portals.
- Produces: The remaining component library named in the specification.

- [x] **Step 1: Implement forms with stable state contracts**

`Field` owns label, description, required marker, error, and `aria-describedby`. Inputs use 40px compact desktop height and 44px touch height. Error overrides neutral/league borders with danger. Disabled fields remain readable. Saving/saved/failure states are explicit text, not color alone.

- [x] **Step 2: Implement navigation and feedback**

Tabs render `role="tablist"`, arrow-key movement, selected underline, and horizontal overflow on mobile. Badges default to neutral and follow the badge budget in Global Constraints. Empty states include title, useful explanation, and at most one contextual action. Skeleton dimensions match loaded content. Progress includes an accessible value label.

- [x] **Step 3: Implement overlays without a new framework**

Use `createPortal` to `document.body`, focus capture/restore, Escape close where allowed, outside-click close for non-destructive menus, scroll lock, and viewport collision handling. Menus must escape table/panel overflow; dialogs use restrained backdrop opacity and a mobile bottom-sheet-like fit without changing semantics. Overlays default to 6px and may use `--radius-overlay: 8px` only where the larger radius improves separation; no overlay may exceed 8px.

- [x] **Step 4: Implement identity primitives**

Provide stable square dimensions, `object-contain`, transparent image backgrounds, initials/fallbacks, and no implicit decorative border. Team and league logos may receive an explicit `framed` prop only where the object truly needs a bounded tile.

- [x] **Step 5: Remove conflicting global selectors and verify**

Replace legacy global input/button rules with primitive-owned selectors only after `rg` confirms no uncovered native controls would become unusable. Run phase gate and keyboard-test tabs, menu, dialog, and form errors in a temporary local harness only if an existing route cannot expose the state; do not commit a harness.

- [x] **Step 6: Commit the complete foundation**

```powershell
git add -- src/components/ui src/app/globals.css
git commit -m "feat: complete shared ui primitives"
```

---

## Phase 2: Global Product Surfaces

### Task 6: Migrate Global Chrome, Access, and Invitation Surfaces

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/AccountNav.tsx`
- Modify: `src/components/LeagueInvitationInbox.tsx`
- Modify: `src/components/LeagueAccessDenied.tsx`

**Interfaces:**
- Consumes: `Action`, `Layout`, `Feedback`, `Overlay`, and product accent scope.
- Produces: Cohesive product header/account/inbox/access patterns used outside league context.

- [ ] **Step 1: Impact-check all four components**

Record route consumers and auth-sensitive paths before editing.

- [ ] **Step 2: Migrate visual structure**

Use product accent for login, signup, global inbox, and account actions. Keep account/destructive actions neutral or danger as appropriate. Replace local rounded cards with `Panel` only for the invitation object and access-denied workflow.

- [ ] **Step 3: Verify interaction states**

Check signed-out header, signed-in account menu, zero invitations, pending invitation, accept/decline loading, unauthorized league, and focus order.

- [ ] **Step 4: Run phase gate and commit**

```powershell
git add -- src/app/layout.tsx src/components/AccountNav.tsx src/components/LeagueInvitationInbox.tsx src/components/LeagueAccessDenied.tsx
git commit -m "feat: migrate global product chrome"
```

### Task 7: Migrate Authentication and Recovery Routes

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`
- Modify: `src/app/forgot-password/page.tsx`
- Modify: `src/app/reset-password/page.tsx`

**Interfaces:**
- Consumes: Product-scoped actions, readable form layout, fields, alerts, loading states.
- Produces: One compact authentication family with unchanged Supabase flows.

- [ ] **Step 1: Impact-check each page component and auth handler**

Do not alter auth callbacks, redirects, validation rules, or query parsing.

- [ ] **Step 2: Apply the common auth composition**

Use `PageShell width="readable"`, one un-nested form panel, shared fields, product primary submit, neutral secondary links, and inline error/success alerts. Operational title is no larger than 30px.

- [ ] **Step 3: Browser QA every state**

Compare login/signup/recovery baselines; verify empty submission, invalid email, invalid credentials, loading, reset sent, expired token, and keyboard submission.

- [ ] **Step 4: Gate and commit**

```powershell
git add -- src/app/login/page.tsx src/app/signup/page.tsx src/app/forgot-password/page.tsx src/app/reset-password/page.tsx
git commit -m "feat: migrate authentication surfaces"
```

### Task 8: Migrate Home, League Index, Profile, Join, and Creation Routes

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/join/page.tsx`
- Modify: `src/app/join/[joinCode]/page.tsx`
- Modify: `src/app/join/JoinDraftForm.tsx`
- Modify: `src/app/create/page.tsx`
- Modify: `src/app/leagues/new/page.tsx`
- Modify: `src/components/LeagueImportModal.tsx`
- Modify: `src/components/SleeperImportForm.tsx`
- Modify: `src/components/ProviderImportForm.tsx`

**Interfaces:**
- Consumes: Global shell, product-scoped actions, forms, feedback, overlays.
- Produces: Cohesive non-league routes; league accent does not leak into these screens.

- [ ] **Step 1: Impact-check route components and submit handlers**

Separate visual edits from league creation/import/join logic. Stop if any handler would need behavior changes.

- [ ] **Step 2: Migrate the global landing and league index**

Preserve the current first-screen product proposition and available actions. Use product accent for Join/Create; use workspace width for the league collection and readable width for prose.

- [ ] **Step 3: Migrate profile and join flows**

Use compact form sections, truthful save states, and product accent. Preserve invite resolution, membership checks, and redirects.

- [ ] **Step 4: Migrate creation/import flows**

Use one shared dialog and form language. Keep provider status and validation visible, and prevent nested cards. Do not expose unsupported providers as working.

- [ ] **Step 5: Browser QA route matrix**

Verify no leagues, one/many leagues, profile success/failure, valid/invalid join code, signed-out join, create validation, import preview, import failure, and modal keyboard behavior.

- [ ] **Step 6: Gate and commit**

```powershell
git add -- src/app/page.tsx src/app/dashboard/page.tsx src/app/profile/page.tsx src/app/join src/app/create/page.tsx src/app/leagues/new/page.tsx src/components/LeagueImportModal.tsx src/components/SleeperImportForm.tsx src/components/ProviderImportForm.tsx
git commit -m "feat: migrate global account and league flows"
```

---

## Phase 3: League Workspace Shell

### Task 9: Migrate the Shared League Workspace

**Files:**
- Modify: `src/app/leagues/[slug]/layout.tsx`
- Modify: `src/app/leagues/[slug]/WorkspaceLayoutClient.tsx`
- Modify: `src/components/LeagueWorkspaceHeader.tsx`
- Modify: `src/context/LeagueWorkspaceContext.tsx` only if a visual identity value is missing; do not change permissions.

**Interfaces:**
- Consumes: League theme variables, `LeagueMark`, navigation primitives, product global header.
- Produces: Stable desktop sidebar, compact mobile workspace navigation, league identity, and content width contract for all league routes.

- [ ] **Step 1: Impact-check shell and context symbols**

Record all league route consumers and whether `LeagueWorkspaceHeader` is active or legacy. Do not remove it until usage is proven absent.

- [ ] **Step 2: Migrate shell geometry**

Keep global DraftHQ identity distinct from league identity. Use league accent for active workspace navigation and focus only. Preserve commissioner-only Settings visibility and the existing Home, League, My Team navigation rules.

- [ ] **Step 3: Implement responsive workspace behavior**

Desktop retains the fixed operational sidebar. Mobile uses compact, reachable navigation without merely stacking desktop chrome. Content must use `workspace` width by default and let form routes opt into `readable` inner columns.

- [ ] **Step 4: Browser QA all roles**

Verify commissioner, co-commissioner, assigned owner, unassigned member, unauthorized user, long league name, missing logo, light accent, and dark accent at both viewports.

- [ ] **Step 5: Gate and commit**

```powershell
git add -- src/app/leagues/[slug]/layout.tsx src/app/leagues/[slug]/WorkspaceLayoutClient.tsx src/components/LeagueWorkspaceHeader.tsx src/context/LeagueWorkspaceContext.tsx
git commit -m "feat: migrate league workspace shell"
```

---

## Phase 4: League Operations

### Task 10: Migrate League Home and Command Center

**Files:**
- Modify: `src/app/leagues/[slug]/LeagueHome.tsx`
- Modify: `src/components/LeagueCommandCenter.tsx`
- Test: `tests/unit/ownerDashboard.test.ts`

**Interfaces:**
- Consumes: Workspace shell, league-scoped actions, compact stats, data surfaces.
- Produces: Commissioner and member dashboard views with preserved readiness/status truth.

- [ ] **Step 1: Impact-check both components and status selectors**

Protect readiness, commissioner action, countdown visibility, draft-room availability, standings, champion/loser, and role-dependent rendering.

- [ ] **Step 2: Migrate the dashboard composition**

Use a 30px page title, compact season/status row, league-scoped operational actions, a dense countdown when a draft exists, wide standings, equal champion/loser objects, and no league-activity section. Preserve the approved role-specific content and copy.

- [ ] **Step 3: Extend existing selector tests only where rendering inputs change**

Do not move business rules into UI primitives. Add cases for no draft, scheduled draft, active draft, completed draft, commissioner, and owner if current tests do not lock those outputs.

- [ ] **Step 4: Compare baseline states and commit**

Verify all dashboard states and both roles. Run phase gate.

```powershell
git add -- src/app/leagues/[slug]/LeagueHome.tsx src/components/LeagueCommandCenter.tsx tests/unit/ownerDashboard.test.ts
git commit -m "feat: migrate league dashboard"
```

### Task 11: Migrate Active Teams and Team Management Overlays

**Files:**
- Modify: `src/app/leagues/[slug]/teams/LeagueTeams.tsx`
- Modify: directly used team edit/assignment overlays within that file or extracted local modules.

**Interfaces:**
- Consumes: `DataSurface`, identity, menu/dialog, league action, status border tokens.
- Produces: Wide active-team management table with stable Team, Owner, and Actions columns.

- [ ] **Step 1: Impact-check team mutation and assignment handlers**

Do not alter creation, owner assignment, uploads, permissions, or database calls.

- [ ] **Step 2: Migrate the team data surface**

Keep only Active Teams framing. Preserve colored left status rails; do not restore Assigned/Needs Owner pills or the removed Setup column. Define stable CSS grid tracks so Owner and Actions align across every row regardless of content.

- [ ] **Step 3: Migrate edit, assign, remove-owner, logo, error, and saving states**

Use shared Dialog, Field, Identity, and Actions. Keep Team Details distinct from Owner Assignment. Preserve add, edit, archive, unarchive, delete, owner assignment/removal, logo upload/replace/remove, validation error, save failure, and saving states. Menus must portal beyond the table overflow boundary.

- [ ] **Step 4: Verify desktop and intentional mobile presentation**

Desktop uses the workspace width. Mobile uses compact team rows with identity/status/action access and no horizontally clipped required action.

- [ ] **Step 5: Gate and commit**

```powershell
git add -- src/app/leagues/[slug]/teams/LeagueTeams.tsx
git commit -m "feat: migrate league team management"
```

### Task 12: Migrate My Team

**Files:**
- Modify: `src/app/leagues/[slug]/my-team/MyTeamForm.tsx`

**Interfaces:**
- Consumes: Readable form layout, TeamMark, owner photo field, fields, upload states, league actions.
- Produces: Assigned-owner team profile editor with unchanged ownership constraints and Draft Night walk-up songs.

- [ ] **Step 1: Impact-check profile, upload, and song handlers**

- [ ] **Step 2: Migrate composition**

Keep team summary alongside a readable form on desktop and above it on mobile. Preserve Team Details under Team Identity, owner photo upload, Draft Night Walk-Up Songs, upload/replace/remove behavior, and save feedback.

- [ ] **Step 3: Verify all states**

Check assigned/unassigned, owner versus commissioner, empty/replaced/removed photo and logo, zero/maximum songs, validation failure, save failure, and saving.

- [ ] **Step 4: Gate and commit**

```powershell
git add -- src/app/leagues/[slug]/my-team/MyTeamForm.tsx
git commit -m "feat: migrate owner team profile"
```

### Task 13: Migrate Members and Permission Overlays

**Files:**
- Modify: `src/app/leagues/[slug]/members/LeagueMembers.tsx`

**Interfaces:**
- Consumes: Data surface, badges, portal menu, confirm dialog, league actions.
- Produces: Compact member/invitation/archive lists with unclipped permission actions.

- [ ] **Step 1: Impact-check member mutation handlers**

Protect invitation, role, removal, ownership transfer, and archive behavior.

- [ ] **Step 2: Migrate current members, invites, and archive**

Use table/list rows rather than oversized member cards. Distinguish commissioner, co-commissioner, member, pending, and former states with semantic text plus color.

- [ ] **Step 3: Migrate menus and confirmations**

Portal ellipsis menus outside all clipping containers. Retain every supported action. Use danger only for destructive actions and explicit confirmation for removal/ownership transfer.

- [ ] **Step 4: Verify role matrix and commit**

Run each action as allowed and disallowed roles, plus empty invites/archive, mobile menus, and keyboard navigation. Run phase gate.

```powershell
git add -- src/app/leagues/[slug]/members/LeagueMembers.tsx
git commit -m "feat: migrate league membership management"
```

### Task 14: Migrate League Settings

**Files:**
- Modify: `src/app/leagues/[slug]/settings/LeagueSettingsForm.tsx`
- Modify: `src/components/SleeperImportForm.tsx` only for league-settings composition not completed in Task 8.

**Interfaces:**
- Consumes: `SettingsShell`, tabs, readable forms, wide member/integration surfaces, save state, upload controls.
- Produces: General, Members, and Integrations tabs under one settings workspace.

- [ ] **Step 1: Impact-check save, branding, member, and integration handlers**

- [ ] **Step 2: Migrate settings shell and General**

Use plain underline tabs with no boxed active tab. Remove Commissioner Access and Settings Status summaries. Keep league name, team count, logo, banner, colors, season data, and preview behavior. Forms use readable width; branding preview may use adjacent workspace width.

- [ ] **Step 3: Migrate Members**

Reuse the compact member and portal-menu patterns from Task 13 without changing behavior.

- [ ] **Step 4: Migrate Integrations**

Remove duplicate top-right connection summary. When one provider is active, show only that provider and its connection/sync controls; when none is active, show supported/available choices and honest unavailable states. Do not invent provider support.

- [ ] **Step 5: Verify trust states and commit**

Check manual save, saving, saved, validation, failure, upload, connection, sync, disconnect confirmation, no integration, and mobile tabs. Run phase gate.

```powershell
git add -- src/app/leagues/[slug]/settings/LeagueSettingsForm.tsx src/components/SleeperImportForm.tsx
git commit -m "feat: migrate league settings"
```

### Task 15: Migrate Seasons and Season Creation

**Files:**
- Modify: `src/app/leagues/[slug]/seasons/LeagueSeasons.tsx`
- Modify: `src/app/leagues/[slug]/seasons/new/NewSeasonForm.tsx`

**Interfaces:**
- Consumes: Workspace data surfaces, readable forms, semantic statuses and actions.
- Produces: Compact season history and create-season workflow.

- [ ] **Step 1: Impact-check season creation and navigation handlers**

- [ ] **Step 2: Migrate season list and empty state**

Use a wide, scannable list/table for season, provider, draft state, teams, and actions. Preserve provider selection, preview, import, manual creation, loading, and import failure states. Use one useful empty state when no seasons exist.

- [ ] **Step 3: Migrate new-season form**

Use a readable form column for manual creation and workspace width for provider previews. Preserve all defaults, provider payloads, validation, and database behavior; use a league-scoped primary action only for the currently selected creation path.

- [ ] **Step 4: Verify and commit**

Check no seasons, historical seasons, active season, validation, creation failure, and mobile. Run phase gate.

```powershell
git add -- src/app/leagues/[slug]/seasons/LeagueSeasons.tsx src/app/leagues/[slug]/seasons/new/NewSeasonForm.tsx
git commit -m "feat: migrate season management"
```

---

## Phase 5: Draft Configuration

### Task 16: Migrate Draft Settings Shell and General Controls

**Files:**
- Modify: `src/app/teams/TeamSetupForm.tsx`
- Modify: `src/components/ClockSettings.tsx`
- Modify: `src/components/ResetDraftModal.tsx`

**Interfaces:**
- Consumes: Workspace toolbar, settings shell, fields, league actions, confirmation dialog.
- Produces: General draft configuration and lifecycle controls with unchanged draft behavior.

- [ ] **Step 1: Impact-check `TeamSetupForm`, clock handlers, and reset handlers**

Treat high-risk draft lifecycle paths as a stop-and-report gate.

- [ ] **Step 2: Migrate shell and General tab**

Keep existing tab names and routing/query behavior. Use compact settings sections, 30px maximum operational title, readable configuration width, and league-scoped Save/Configure actions.

- [ ] **Step 3: Migrate clock and reset controls**

Keep timer duration, pause/expiry behavior, validation, permissions, and reset confirmation exact. Reset remains danger even with a league accent.

- [ ] **Step 4: Verify state and commit**

Check draft absent/created/scheduled/active/completed, validation, unsaved/saving/saved/failure, and reset confirmation. Run phase gate.

```powershell
git add -- src/app/teams/TeamSetupForm.tsx src/components/ClockSettings.tsx src/components/ResetDraftModal.tsx
git commit -m "feat: migrate draft configuration shell"
```

### Task 17: Migrate Draft Teams, Order, Audio, and Presentation Tabs

**Files:**
- Modify: `src/app/teams/TeamSetupForm.tsx`
- Modify: `src/components/CommissionerParticipantManager.tsx`
- Modify: `src/components/SongPicker.tsx`
- Modify: provider/audio controls directly rendered by these components.

**Interfaces:**
- Consumes: Wide data surfaces, compact rows, form controls, overlays, league accent.
- Produces: Complete Draft Settings experience across all existing tabs.

- [ ] **Step 1: Impact-check participant, order, audio, and presentation handlers**

- [ ] **Step 2: Migrate Teams and Order**

Use wide workspace layouts for team/order management. Keep drag/reorder or existing sequencing behavior, assignments, draft positions, permissions, and all available actions.

- [ ] **Step 3: Migrate Audio and Presentation**

Use compact controls and honest connection/loading/error states. Preserve search, preview, selection, upload, removal, and playback behavior.

- [ ] **Step 4: Verify all tabs and commit**

Browser-check every tab at desktop/mobile, all empty/loading/error states, keyboard controls, and retained values after navigation. Run phase gate.

```powershell
git add -- src/app/teams/TeamSetupForm.tsx src/components/CommissionerParticipantManager.tsx src/components/SongPicker.tsx
git commit -m "feat: migrate draft setup workflows"
```

---

## Phase 6: Draft Night

### Task 18: Migrate Draft Lobby Without Changing Its Anatomy

**Files:**
- Modify: `src/components/DraftLobby.tsx`
- Modify: `src/app/draft/lobby/page.tsx` only if route-level shell classes require migration.

**Interfaces:**
- Consumes: Shared Draft Night tokens, panel/action/badge/input primitives, league accent.
- Produces: Cohesive lobby preserving team rotation, audio, presence, commissioner controls, and start behavior.

- [ ] **Step 1: Impact-check lobby rendering and event handlers**

Protect presence, current team, playback, progression, Start Draft, permissions, and routing.

- [ ] **Step 2: Replace visual literals with shared roles**

Preserve compact league header, featured team, sequence, narrow readiness/assigned strip, bottom-right online count/Start Draft, broadcast controls, atmosphere, and transitions. Use shared radii, borders, typography, status semantics, inputs, and buttons. Primary Start Draft uses accessible league accent.

- [ ] **Step 3: Verify all lobby states**

Check commissioner/member, online/offline teams, assigned/unassigned, setup needs attention, audio ready/unavailable, playing/paused, Start Draft enabled regardless of attendance, mobile first viewport, and long team/league names.

- [ ] **Step 4: Gate and commit**

Use all four Draft Night viewports and baseline comparisons.

```powershell
git add -- src/components/DraftLobby.tsx src/app/draft/lobby/page.tsx
git commit -m "feat: converge draft lobby visuals"
```

### Task 19: Migrate Draft Room Shell, Header, Toolbar, and Board

**Files:**
- Modify: `src/app/draft/DraftRoom.tsx`
- Modify: `src/components/DraftTimer.tsx`
- Modify: `src/components/DraftBoard.tsx`

**Interfaces:**
- Consumes: Draft Night tokens, league accent, toolbar/actions/forms, existing timer/board contracts.
- Produces: Shared visual language around the approved pre-Phase-6-style header and current board behavior.

- [ ] **Step 1: Impact-check all three components**

Warn before editing if GitNexus reports HIGH/CRITICAL risk. Preserve current team, ownership, round/pick, next-up, timer, commissioner controls, search, view switching, and pick behavior.

- [ ] **Step 2: Migrate the approved header and toolbar presentation**

Do not reintroduce the rejected header redesign. Keep the current team name scale, enlarged borderless logo with `object-contain`, current timer arrangement, existing Round/Pick placement, wider player search, and no highlight solely because a team belongs to the viewer.

- [ ] **Step 3: Migrate board visual roles**

Use semantic surfaces/borders/text while retaining compact density and position color logic across Draft Board, Player Board, Roster Board, and Roster Summary. On-clock cell border and Picking state use the accessible league accent. Do not alter view switching, cell data, player filters, roster totals, scrolling, pick order, or board calculations.

- [ ] **Step 4: Verify interaction and viewport matrix**

Check 1366x768, 1440x900, 1920x1080, and basic 390x844. Test running/paused/expired timer, commissioner/non-commissioner, owner/non-owner, search, select player, board switching, and accent extremes.

- [ ] **Step 5: Gate and commit**

```powershell
git add -- src/app/draft/DraftRoom.tsx src/components/DraftTimer.tsx src/components/DraftBoard.tsx
git commit -m "feat: converge draft room shell and board"
```

### Task 20: Migrate Draft Room Supporting Panels and Overlays

**Files:**
- Modify: `src/components/PickModal.tsx`
- Modify: `src/components/RecentPicks.tsx`
- Modify: `src/components/DraftChat.tsx`
- Modify: `src/components/DraftTicker.tsx`
- Modify: other overlays rendered directly by `DraftRoom.tsx` only when in scope.

**Interfaces:**
- Consumes: Dialog, menu, fields, action, identity, status, semantic Draft Night surfaces.
- Produces: Cohesive pick workflow, chat, recent picks, and ticker with unchanged behavior.

- [ ] **Step 1: Impact-check each interaction component**

- [ ] **Step 2: Migrate pick and recent-pick surfaces**

Preserve player search, selection, validation, confirmation, commissioner override, loading, and failure. Make the primary pick action league-accented only inside the league draft.

- [ ] **Step 3: Migrate chat and ticker**

Preserve message behavior, unread state, auto-scroll rules, ticker ordering, and normal-mode ticker operation in TV Mode. Use stable heights so content changes do not shift the board.

- [ ] **Step 4: Verify and commit**

Test keyboard/modal focus, pick success/failure, long names, chat empty/loading/messages, ticker with zero/many items, and fullscreen transitions. Run phase gate.

```powershell
git add -- src/components/PickModal.tsx src/components/RecentPicks.tsx src/components/DraftChat.tsx src/components/DraftTicker.tsx src/app/draft/DraftRoom.tsx
git commit -m "feat: migrate draft room interactions"
```

### Task 21: Migrate TV Mode, Draft Completion, Recaps, and Awards

**Files:**
- Modify: `src/app/draft/DraftRoom.tsx`
- Modify: `src/components/DraftGradesBoard.tsx`
- Modify: `src/components/DraftAwardsCeremony.tsx`
- Modify: `src/components/DraftOrderRace.tsx`
- Modify: `src/components/LandmineAnimation.tsx`
- Modify: `src/components/WalkUpPlayer.tsx`

**Interfaces:**
- Consumes: Shared presentation typography, motion tokens, identity primitives, semantic accent/status colors.
- Produces: Cohesive presentation states preserving approved cinematic workflows.

- [ ] **Step 1: Impact-check presentation components and state transitions**

- [ ] **Step 2: Migrate TV Mode chrome and fullscreen transitions**

Preserve full-screen composition and behavior. Ensure exiting fullscreen recomputes layout without clipping or stale fullscreen dimensions. Team logo remains borderless. Ticker behavior matches normal mode.

- [ ] **Step 3: Migrate reveal, race, grades, and awards styling**

Preserve timing, sequence, audio, animation, data, and commissioner flow. Apply 40px display typography only where viewing distance requires it. Use league accent as highlights, never a large solid backdrop.

- [ ] **Step 4: Respect reduced motion**

Under `prefers-reduced-motion: reduce`, keep state transitions understandable with instant/short opacity changes while preserving completion callbacks and functional sequencing.

- [ ] **Step 5: Verify and commit**

Check TV Mode fullscreen/windowed transitions, pick reveal, round recap, grades, draft complete, awards, reduced motion, 1366/1440/1920 widths, and audio controls. Run phase gate.

```powershell
git add -- src/app/draft/DraftRoom.tsx src/components/DraftGradesBoard.tsx src/components/DraftAwardsCeremony.tsx src/components/DraftOrderRace.tsx src/components/LandmineAnimation.tsx src/components/WalkUpPlayer.tsx
git commit -m "feat: converge draft presentation surfaces"
```

---

## Phase 7: Transitional and Utility States

### Task 22: Migrate Callback, Loading, and Route-Level Error States

**Files:**
- Modify: `src/app/spotify-callback/page.tsx`
- Modify: `src/app/spotify-popup-callback/page.tsx`

**Interfaces:**
- Consumes: Product shell, feedback, progress, and product accent.
- Produces: Branded transitional states with clear status and recovery.

- [ ] **Step 1: Inventory all user-visible transitional routes**

Run `rg --files src/app | rg "(loading|error|not-found)\\.tsx$"`. The current audit found no route-level files, so do not invent them solely for visual migration. Do not modify API routes. Record callback success/failure/closing behavior before styling.

- [ ] **Step 2: Migrate callback and route states**

Use compact centered status surfaces only when the workflow itself is self-contained. Preserve opener messaging, redirects, callback parameters, retry, and close behavior.

- [ ] **Step 3: Verify and commit**

Check callback success/failure without exposing tokens, loading dimensions, error recovery, mobile, and keyboard focus. Run phase gate.

```powershell
git add -- src/app/spotify-callback/page.tsx src/app/spotify-popup-callback/page.tsx
git commit -m "feat: migrate transitional product states"
```

---

## Phase 8: Convergence and Release Audit

### Task 23: Remove Visual-System Residue and Compatibility Code

**Files:**
- Modify: `src/components/CommandCenterUI.tsx` or delete it after zero consumers.
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/index.ts`
- Modify: remaining user-facing files identified by the searches below.

**Interfaces:**
- Consumes: All migrated routes and shared primitives.
- Produces: One public primitive boundary with no orphaned visual language.

- [ ] **Step 1: Run residue searches**

```powershell
rg "CommandCenterUI|#([0-9a-fA-F]{3}){1,2}|rounded-(xl|2xl|3xl)|bg-(blue|cyan|teal|emerald|red|amber)-" src/app src/components src/context
rg "style=\{\{" src/app src/components
rg "<button|<input|<select|<textarea" src/app src/components
```

Classify each result as semantic data color, intentional Draft Night geometry, shared primitive implementation, or migration residue. Replace only residue; document justified exceptions in the baseline ledger.

- [ ] **Step 2: Remove compatibility exports only when unused**

Run `rg "CommandCenterUI" src`. If only the definition remains, delete the file and remove exports. If consumers remain, migrate them in this task and repeat the search.

- [ ] **Step 3: Audit copy, density, and widths**

Confirm title case in user-facing operational labels, no unnecessary expiry metric where removed by approved UX, 30px operational title ceiling, compact controls, no nested panels, readable forms, and wide data surfaces.

- [ ] **Step 4: Commit convergence cleanup**

Run the phase gate first.

```powershell
git add -- src docs/ui-audit/global-redesign-baselines.md
git commit -m "refactor: complete visual system convergence"
```

### Task 24: Full Product Verification and Final Review

**Files:**
- Modify: `docs/ui-audit/global-redesign-baselines.md`
- Modify: `tests/e2e/smoke.spec.mjs` only when selectors reference retired presentation details; preserve behavioral assertions.

**Interfaces:**
- Consumes: Entire migrated application and baseline ledger.
- Produces: Release evidence and a final working branch; no merge to `main`.

- [ ] **Step 1: Run the complete automated suite**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:unit
npm.cmd run build
npm.cmd run test:e2e
git diff --check
```

If local Supabase prevents E2E execution, report the exact blocker and do not claim E2E passed. Do not add a testing dependency to bypass environment setup.

- [ ] **Step 2: Run the complete route matrix**

Revisit every ledger row. Verify role/permission boundaries, creation and save flows, empty/loading/error states, draft lifecycle, realtime/timer controls, audio, fullscreen, mobile, and TV widths.

- [ ] **Step 3: Complete side-by-side baseline review**

For each route, record:

```md
- Preserved: information, primary task, available actions, workflow outcome.
- Improved: hierarchy, density, consistency, accessibility, responsive behavior.
- Intentional difference: exact visual or structural change and its approved rationale.
- Regression check: pass/fail, with defect link or fix commit when failed.
```

Do not approve the redesign while any migrated route has lost required information, actions, or functional state.

- [ ] **Step 4: Run final GitNexus scope review**

Run `detect_changes({scope: "compare", base_ref: "main"})`. Confirm no database, permission, routing, draft-logic, timer, realtime, or audio execution flow changed except unavoidable render-call edges already reviewed.

- [ ] **Step 5: Commit verification evidence**

```powershell
git add -- docs/ui-audit/global-redesign-baselines.md tests/e2e/smoke.spec.mjs
git commit -m "test: verify global visual migration"
```

Do not merge or push unless the user explicitly requests it.

---

## Phase Review Deliverable

After each phase, report:

1. Routes and states migrated.
2. Shared tokens/primitives added or reused.
3. Functional behavior explicitly preserved.
4. Baseline comparison findings at desktop and mobile, plus TV widths where relevant.
5. Automated verification results and any environment-limited checks.
6. Remaining risks or intentional exceptions.
7. Commit hash and message.

Stop at each phase boundary for review when requested. Never begin the next route family while the current phase has known regressions.
