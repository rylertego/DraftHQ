# DraftHQ Global Visual System Design

## Status

Approved for implementation planning on 2026-08-13. This specification defines the visual system and migration strategy. It does not authorize functionality, business-logic, database, permission, routing, or feature changes.

## Objective

Mature DraftHQ from a collection of rounded dashboard cards into one cohesive, professional fantasy-sports application. The result must feel like premium sports operations and broadcast software: sharp, dense, intentional, reliable, and recognizably DraftHQ.

The redesign must preserve all current information, workflows, permissions, specialized draft behavior, and league customization. Visual improvements should be achieved through shared semantic tokens, shared primitives, and route migration rather than independent page styling.

## Product Expressions

DraftHQ has one design system with two expressions.

### Operations Mode

Used for authentication, account management, league management, settings, teams, members, seasons, and draft configuration.

- Defaults to compact density.
- Uses aligned page headers, section dividers, compact forms, dense lists, and professional tables.
- Emphasizes trust, scan speed, and efficient commissioner workflows.
- Operational page titles normally use the 30px Page Title scale or smaller.
- Proposed control heights, spacing, and table row heights are targets; implementations should not expand vertically without a content or accessibility reason.

### Draft Night Mode

Used for the lobby, draft room, TV mode, pick presentation, round recaps, draft completion, and awards.

- Preserves the current specialized layout anatomy and workflows.
- Uses the same semantic colors, typography families, radii, controls, borders, focus states, spacing scale, and responsive rules as Operations Mode.
- May use larger display typography, stronger team and league branding, presentation motion, and full-screen composition.
- Structural changes are limited to clear clipping, spacing, hierarchy, accessibility, or responsiveness defects.
- Draft Night Mode is an expression of DraftHQ, not a second theme or separate application.

## Design Principles

1. **Hierarchy before containers.** Use typography, spacing, alignment, dividers, and background contrast before adding a framed panel.
2. **Compact by default.** Operational surfaces optimize for scanning and repeated action, not decorative whitespace.
3. **One semantic system.** Callers request roles such as product primary, league primary, secondary, warning, or danger. They do not supply raw colors.
4. **Objects earn cards.** A team, invitation, draft, historical season, or self-contained workflow may justify a card. An ordinary settings category usually does not.
5. **No nested panels.** Internal grouping uses sections, columns, dividers, data rows, or subtle surface changes.
6. **Data uses the workspace.** Standings, rosters, draft boards, team lists, and management tables intelligently use wide or full-width layouts.
7. **Presentation preserves function.** Draft-night polish must not weaken live readability or commissioner control.
8. **Accessible by construction.** Contrast, focus, touch targets, semantics, and motion preferences are part of primitive interfaces.
9. **Stable phase boundaries.** Every migration phase leaves DraftHQ working, reviewable, and free of knowingly broken or partially functional routes.
10. **Existing stack first.** Do not introduce a major UI framework or testing dependency solely for this redesign unless the current Next.js, React, Tailwind, Vitest, and Playwright stack cannot satisfy a documented technical requirement.

## Color System

### Product Colors

The design system uses semantic product-accent terminology. The implementation value is DraftHQ's current blue/cyan brand color; no shared interface is coupled to a specific hue name.

Required semantic families:

- `canvas`: near-black navy page background.
- `shell`: navigation and fixed application chrome.
- `surface-1`: primary working surface.
- `surface-2`: raised controls and grouped data.
- `surface-3`: hover and selected neutral surface.
- `border-subtle`: dividers and low-emphasis boundaries.
- `border-strong`: controls and important boundaries.
- `text-primary`: near-white.
- `text-secondary`: cool light gray.
- `text-muted`: blue-gray metadata.
- `product-accent`: global DraftHQ action and focus color.
- `success`, `warning`, `danger`, `info`: semantic status families.

Each accent and semantic family must expose base, hover, muted, border, foreground, and focus-ring values where relevant.

### Product Accent Ownership

Product-accent tokens are used for:

- Authentication actions.
- Account and profile controls.
- Global navigation.
- Creating or joining leagues.
- Standalone drafts and other non-league-specific actions.
- Global focus states outside a league workspace.

### League Accent Ownership

Inside a league workspace, primary operational actions use the configured league accent. League accent tokens may also style:

- Active workspace navigation.
- Selected settings and draft-configuration tabs.
- Focus states.
- Key league-specific statistics.
- Thin header accents and row rails.
- Rankings and current-pick indicators.
- Important league-specific highlights.

League accent tokens must not fill large background surfaces. Secondary and tertiary actions remain neutral. Destructive actions remain red regardless of league configuration. Semantic statuses do not inherit the league accent.

### Status Is Not Conveyed By Colour

**Amended 2026-08-13.** Operational status values — readiness percentages, counts
such as "3/10 owners", draft lifecycle labels, checklist items — render in
**standard foreground text, not a semantic colour**. The previous rule kept
amber/green/red on these; it produced dashboards where nearly every number was
tinted and the tint stopped meaning anything.

Status must be legible from **the words and the arrangement**, not the hue:

- Say what is true. "3 of 10 owners assigned" already carries the state; it does
  not need to be amber to say it.
- Where a state genuinely needs marking, use an **icon** or a neutral outline,
  not a colour fill.
- Rank and group by state where layout allows, so "needs attention" is found by
  position rather than by scanning for colour.

Colour is reserved for three things and stays meaningful because of it:

1. **Destructive** actions and genuine error states — red.
2. **Live** draft state — the one moment a colour should pull the eye.
3. The **league accent**, on the surfaces already enumerated above.

This is also the accessible default: status that depends on hue alone fails for
colour-blind users and in TV-mode glare, both of which apply here.

### Accessible Accent Derivation

`LeagueThemeProvider` will expose CSS variables for:

- `--league-accent`
- `--league-accent-hover`
- `--league-accent-muted`
- `--league-accent-border`
- `--league-accent-foreground`
- `--league-focus-ring`

A shared pure color utility will parse supported hex colors, calculate relative luminance and contrast, and derive accessible interactive variants. The utility will select either dark ink or white for foreground text. When the configured accent itself cannot meet the required contrast for an interactive fill against either foreground choice, the interactive derivative will be lightened or darkened while the original accent remains available for non-text decorative highlights.

Minimum targets:

- WCAG AA 4.5:1 for ordinary text.
- WCAG AA 3:1 for large text, focus indicators, and meaningful non-text controls.
- Status must never rely on color alone.

## Typography

DraftHQ retains Sora and Geist.

| Role | Font | Size / Line | Weight | Use |
|---|---|---:|---:|---|
| Display | Sora | 40 / 44 | 800 | Primarily Draft Night and presentation surfaces |
| Page Title | Sora | 30 / 36 | 800 | Operational page titles; normal maximum |
| Section Title | Sora | 18 / 24 | 700 | Major workspace sections |
| Subsection Title | Sora | 15 / 20 | 700 | Form and panel subdivisions |
| Body | Geist | 14 / 21 | 400 | Main copy |
| Strong Body | Geist | 14 / 20 | 600 | Primary row values and compact headings |
| Control | Geist | 13 / 18 | 600 | Buttons, tabs, and inputs |
| Caption | Geist | 12 / 17 | 400 | Helper text and metadata |
| Eyebrow | Geist | 11 / 14 | 700 | Select operational or broadcast metadata |

Uppercase is reserved for operational metadata, table headers, clock labels, and broadcast identifiers. Ordinary field labels and body text use sentence or title case. Typography uses explicit breakpoint steps rather than viewport-width scaling. Letter spacing is never negative.

## Spacing, Density, And Width

Base spacing scale: `4, 8, 12, 16, 20, 24, 32, 40, 48` pixels.

Operations Mode targets:

- Desktop page gutters: 24px.
- Mobile page gutters: 16px.
- Major section separation: 24px.
- Subsection separation: 16px.
- Control gaps: 8-12px.
- Compact data rows: approximately 52-64px when content allows.
- Desktop controls: 36-40px high.
- Touch-oriented controls: at least 44px high or wide.

Content-width modes:

- `readable`: forms and prose-oriented configuration, approximately 720px.
- `workspace`: settings and management layouts, approximately 1440-1600px.
- `full`: standings, rosters, draft boards, team grids, management tables, and live draft surfaces.

The readable width is not a general page cap. Data-heavy surfaces must use the wider application workspace intelligently.

## Geometry And Elevation

- Open page sections: normally no radius.
- Standard framed surface: 4px.
- Inputs, selects, and buttons: 4px.
- Standalone object cards: 6px.
- Modals and popovers: 6-8px maximum.
- Status badges may remain pill-shaped.
- Circular geometry is reserved for avatars, presence dots, and media/playback controls.

Ordinary page surfaces use subtle one-pixel borders, dividers, and background contrast. Shadows are reserved for dialogs, menus, popovers, and presentation overlays. Strong page-level shadows are prohibited.

## Container Model

### `PageShell`

Owns content width, gutters, density mode, and responsive behavior. Variants: `readable`, `workspace`, and `full`; expression: `operations` or `draft-night`.

### `PageHeader`

Renders context, title, description, and right-aligned actions in an open layout with an optional bottom divider or thin accent line. It does not render a giant enclosing card.

### `Section`

Groups related content with heading, description, optional actions, spacing, and an optional divider. It is the default grouping primitive.

### `Panel`

Frames a genuinely standalone object or workflow. It supports compact headers and footers but cannot contain another `Panel`.

### `DataSurface`

Owns table, standings, roster, or dense-list framing, row density, header treatment, separators, hover behavior, overflow, and responsive alternatives.

### `FormLayout`

Owns readable form width, label alignment, field spacing, validation placement, and action placement.

### `SettingsShell`

Composes `PageHeader`, flat tabs, responsive save actions, and unsaved/saving/saved/error states without requiring each category to become a card.

### `WorkspaceToolbar`

Provides compact, consistently sized operational controls above data-heavy surfaces.

## Core Interaction Primitives

### Actions

- `Button`: variants `product`, `league`, `secondary`, `tertiary`, and `danger`.
- `LinkButton`: navigation equivalent of `Button`.
- `IconButton`: square controls with accessible names and tooltips where the icon is not universally obvious.

Primary actions are unique within their local action group. Secondary and tertiary actions do not inherit accents. Danger remains red. Controls use compact dimensions in Operations Mode and touch-safe dimensions on touch-oriented layouts.

### Forms

- `Field`
- `Input`
- `Select`
- `Textarea`
- `Checkbox`
- `Radio`
- `Switch`
- `Stepper`
- `FileUpload`
- `ColorControl`

Form primitives own labels, descriptions, required state, validation state, disabled state, and accessible associations. Inputs use flat surfaces, clear borders, and semantic focus tokens.

### Navigation And Selection

- `Tabs`: flat text with an underline indicator and optional counters; horizontally scrollable on mobile.
- `Menu`: overlay menu rendered outside clipping containers.
- `Popover`
- `Tooltip`

Segmented or pill controls are permitted only for genuine mode selection.

### Status And Feedback

- `StatusBadge`: compact status with text and optional dot/icon. Neutral by
  default — see "Status Is Not Conveyed By Colour" and the badge budget below.
- `RoleBadge`: commissioner, co-commissioner, owner, or member identity.
  **Restricted** — see the badge budget below.

### Badge Budget

**Amended 2026-08-13.** Badges had no usage rule, so they accumulated: a members
list where all three rows carry a role pill, dashboards where every tile has a
status chip. A badge earns attention by being rare, and these had stopped being
rare.

**A badge is justified only when it marks an exception.** If every row in a list
has one, it is not a badge — it is a column, and should be rendered as one.

`RoleBadge` is permitted on:

- The league **members list**, and only for roles above `member`. Plain members
  get no pill; ordinary membership is the default state and needs no marking.
- **Draft-night surfaces** where commissioner authority must be unmistakable —
  lobby and draft room.

`RoleBadge` is **not** permitted on team rows, member cards, avatars, dashboard
tiles, or anywhere the role is already implied by the surface the viewer is on.

`StatusBadge` is permitted **once per surface at most**, on the single fact that
governs what the viewer should do next. Everything else states its status in
words. Prefer no badge over a badge that repeats the heading.
- `Alert`: compact message with title, description, icon, and optional action.
- `InlineNotice`: non-blocking guidance within a natural content flow.
- `Toast`: transient success or failure feedback.
- `Progress`: determinate or indeterminate operational progress.

Persistent explanatory copy should not be promoted into an alert without a status or action reason.

### Overlays

- `Dialog`: focus trap, labelled title, Escape behavior, backdrop, scroll containment, and focus restoration.
- `ConfirmDialog`: neutral cancellation and a single clear confirm action.

Dialog width follows content. Body and footer are divided. Backdrop blur is minimal. Menus and dialogs use the shared overlay z-index scale and cannot be clipped by parent surfaces.

### Identity And State

- `Avatar`
- `TeamMark`
- `LeagueMark`
- `EmptyState`
- `Skeleton`

Empty states live in the section they explain, use concise text, and expose at most one primary next action. Skeletons preserve the final layout dimensions.

## Domain Modules

Domain modules compose primitives while leaving data, permissions, and business behavior with existing route modules.

- `LeagueWorkspaceShell`: desktop sidebar, mobile navigation, league identity, workspace colors, loading, and access failures.
- `LeagueIdentity`: crest, league name, and concise membership context.
- `ManagementTable`: aligned headers, compact rows, actions, overflow behavior, and mobile adaptation.
- `TeamRosterRow`: team identity, owner state, status rail, and actions.
- `StandingsTable`: rank, team, record, points, and league-accent ranking emphasis.
- `SettingsSection`: open configuration section with form-width behavior.
- `DraftSettingsShell`: draft title, flat tabs, status, save behavior, and actions.
- `DraftStatusBar`: compact lifecycle, connection, ownership, and readiness states.
- `BroadcastControlBar`: coherent draft/lobby audio, playback, and commissioner controls.
- `LiveDraftHeader`: current team, timer, round, pick, and upcoming teams using the existing approved anatomy.
- `DraftBoardSurface`: board framing, headers, active-pick emphasis, and overflow behavior.
- `PresentationOverlay`: pick reveal, recap, completion, awards, and TV presentation framing.

## Feedback, Motion, And Responsive Behavior

### Feedback

- Validation appears next to the affected field and is summarized only when necessary.
- Saving states keep controls stable and communicate progress without changing layout.
- Save success is quiet and truthful; failure remains visible until resolved or dismissed.
- Loading, empty, disconnected, permission-denied, and unavailable states use shared primitives and preserve information hierarchy.

### Motion

- Controls: 120-180ms.
- Panels and state transitions: 180-280ms.
- Longer motion is limited to intentional draft presentation.
- No decorative continuous motion in Operations Mode.
- `prefers-reduced-motion` disables or simplifies nonessential movement.

### Responsive Rules

- Desktop remains the canonical management and draft-board target.
- Mobile layouts reorder actions based on workflow priority rather than merely stacking desktop columns.
- Tables choose among horizontal overflow, priority-column reduction, or compact rows based on the task; they are not automatically converted into large cards.
- Tabs remain usable through horizontal scrolling.
- Primary actions remain reachable and meet 44px touch targets.
- Fixed draft controls must account for browser chrome and changing viewport height.

## Route Inventory And Migration Strategy

The inventory contains 21 page routes plus shared overlays and embedded draft states.

### Phase 1: Foundation And Baselines

Scope:

- Capture authenticated and public screenshots for every reachable major state.
- Record role, data, and viewport used for each capture.
- Add semantic tokens and accessible color derivation.
- Build core primitives without changing route appearance until a route is migrated.
- Establish the route/state review checklist and visual residue checks.

Exit criteria:

- Existing routes remain functional and visually unchanged except for deliberate foundational fixes.
- Contrast derivation has unit tests covering light, dark, invalid, and low-contrast accents.
- Primitive examples or focused tests cover variants and accessibility behavior.
- Baseline captures exist for later comparison.

### Phase 2: Global Product Shell

Routes and surfaces:

- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/profile`
- `/join`
- `/join/[joinCode]`
- `/create`
- `/leagues/new`
- Global account navigation.
- Account menu.
- Invitation inbox.
- League access-denied states.

Direction:

- Apply product-accent tokens.
- Replace oversized authentication and creation cards with compact, purposeful form framing.
- Flatten the global header and menus.
- Convert the dashboard to a dense league list and restrained utility region.
- Preserve all authentication, invitation, creation, joining, deletion, and navigation behavior.

### Phase 3: League Workspace Shell

Scope:

- `/leagues/[slug]/layout`
- Desktop sidebar.
- Mobile navigation.
- League identity region.
- Workspace gutters and widths.
- Active navigation.
- Workspace loading, error, and permission states.

Direction:

- Integrate the league crest and name into the shell without a floating identity card.
- Use league accent for active navigation and focus.
- Standardize commissioner and member navigation while preserving permission-based destinations.
- Establish compact operational geometry inherited by all league routes.

### Phase 4: League Management

Routes:

- `/leagues/[slug]`
- `/leagues/[slug]/teams`
- `/leagues/[slug]/my-team`
- `/leagues/[slug]/members`
- `/leagues/[slug]/settings`
- `/leagues/[slug]/seasons`
- `/leagues/[slug]/seasons/new`

Embedded states and overlays:

- Draft creation and reset confirmations.
- Add, edit, archive, unarchive, and delete team states.
- Owner assignment and invitation states.
- Team and owner image upload states.
- Member role, removal, ownership transfer, and invitation dialogs.
- League branding, integration, validation, saving, and failure states.
- Season provider selection, previews, imports, and manual creation.

Direction:

- Use open headers and sections for dashboards and settings.
- Use `DataSurface` for teams, members, standings, and season lists.
- Use `readable` widths only for configuration forms and prose.
- Preserve the current commissioner/member dashboard distinctions and league-accent behavior.

### Phase 5: Draft Configuration

Route:

- `/teams?draftId=...`

States:

- General.
- Teams & Order.
- Audio & Presentation.
- Commissioner and read-only views.
- Loading, validation, saving, saved, failure, active-draft lock, and reset confirmation.
- Team expansion, assignment, media upload, preview, and removal states.

Direction:

- Migrate the draft settings shell, tabs, forms, notices, tables/lists, controls, and dialogs.
- Preserve every existing draft option, ordering behavior, owner-assignment rule, audio behavior, and permission.

### Phase 6: Draft Night

Routes and surfaces:

- `/draft/lobby`
- `/draft`
- Draft Board.
- Player Board.
- Roster Board.
- Roster Summary.
- TV Mode.
- Pick modal and pick reveal.
- End-of-round recap.
- Draft completion.
- Awards ceremony.
- Chat, ticker, audio controls, clock settings, and commissioner tools.

Direction:

- Preserve approved layout anatomy and specialized workflows.
- Apply shared controls, geometry, borders, typography, focus states, semantic statuses, and league accents.
- Correct only clear clipping, spacing, hierarchy, accessibility, or responsive defects.
- Verify desktop, laptop, TV-width, full-screen, exited-full-screen, and basic mobile behavior.

### Phase 7: Utility And Transitional States

Routes and states:

- `/spotify-callback`
- `/spotify-popup-callback`
- Remaining loading screens.
- Empty, disconnected, unavailable, permission-denied, saving, and failure states.
- All remaining menus, popovers, and dialogs.

Callback routes remain visually minimal but use product tokens.

### Phase 8: Global Residue Audit

Search every user-facing TSX and CSS file for:

- `rounded-xl`, `rounded-2xl`, and `rounded-3xl`.
- Page-local button, input, badge, alert, panel, and modal classes.
- Hard-coded product and league accent colors.
- Nested panels.
- Unnecessary shadows.
- Excessive padding and control heights.
- Clipped menus and dialogs.
- Unmigrated loading, empty, error, disabled, and saving states.

Exceptions are allowed only when semantically justified and documented, such as status pills, circular playback controls, and presentation overlays.

## Phase Quality Gates

Every phase must leave DraftHQ working and reviewable. A phase cannot be committed as complete when it knowingly leaves a migrated or dependent route broken, visually half-migrated, or functionally incomplete.

Required verification for each phase:

1. Run type checking.
2. Lint every changed file.
3. Run the full test suite.
4. Run the production build.
5. Run `git diff --check`.
6. Run GitNexus impact analysis before symbol edits and `detect_changes` before commits.
7. Perform browser QA for every migrated route and relevant role/state.
8. Capture desktop, laptop, and mobile screenshots; add TV-width checks for draft presentation.
9. Compare migrated screenshots directly with baseline captures.
10. Record a comparison ledger covering preserved functionality, preserved information, hierarchy changes, typography, density, color ownership, geometry, responsive behavior, and intentional deviations.
11. Exercise the route's core interaction path rather than relying on screenshots alone.

Browser QA must prove that functionality and information hierarchy were preserved while the visual language changed. Passing tests and builds does not replace this visual and interaction comparison.

## Role And State Coverage

The complete migration must verify, where applicable:

- Commissioner.
- Co-commissioner.
- Assigned owner.
- Unassigned member.
- Unauthenticated visitor.
- League access denied.
- Connected and disconnected integrations.
- Empty and incomplete league setup.
- Draft not created, scheduled, ready, active, paused, and completed.
- Loading, saving, saved, validation failure, request failure, disconnected, disabled, and destructive-confirmation states.

## Testing Strategy

- Unit-test pure accent and contrast derivation.
- Add focused tests for primitive behavior when it contains logic or accessibility contracts.
- Preserve existing business-logic tests unchanged unless markup queries must be updated to retain the same user-visible behavior.
- Prefer semantic queries and user interaction over class-name snapshots.
- Use the existing Vitest and Playwright stack.
- Do not add a visual-regression platform or component framework unless a specific limitation is documented and approved.

## Non-Goals

- No business-logic rewrite.
- No routing changes.
- No database changes.
- No permission changes.
- No feature removal or invention.
- No draft-flow changes.
- No replacement of DraftHQ's dark identity.
- No elimination of league accent customization.
- No generic SaaS redesign.
- No major new UI framework introduced solely for the redesign.

## Completion Definition

The redesign is complete only when:

- Every route and embedded user-facing state in this inventory has been reviewed.
- Shared primitives own recurring visual behavior.
- Product and league accents follow semantic ownership and accessible contrast rules.
- Operations Mode is compact and data-efficient.
- Draft Night Mode remains functionally familiar and visually related to the rest of DraftHQ.
- No old visual-language remnants remain without a documented exception.
- All verification gates pass.
- Baseline comparisons confirm preserved information hierarchy and workflows.
- The resulting primitive interfaces make new DraftHQ pages inherit the approved visual language without page-specific styling.
