# DraftHQ Brand Guidelines

## Brand Personality

DraftHQ is a commissioner-grade draft platform — serious about reliability,
clean in presentation, and built for the moment when a league's season begins.
The brand is confident without being loud. It earns trust through precision and
restraint rather than hype.

Tone: focused, direct, sport-adjacent without being a sports media brand.
Visual register: dark-mode native, data-dense interfaces that feel calm rather
than cluttered, with teal as the single accent that marks every active,
interactive, and on-the-clock moment.

---

## Logo

### Mark

A shield with a crown integrated into its upper section. The shield conveys
authority and protection — the commissioner controls the room. The crown signals
primacy — the draft is the league's most important moment.

The mark works as a standalone icon at small sizes (app icon, favicon, navbar
collapse). At full lockup, it sits left of the wordmark with consistent spacing.

### Wordmark

**DraftHQ** in Sora Bold or Sora ExtraBold. Set in sentence case exactly as
written: capital D, capital H, capital Q. No all-caps. No stylized ligatures.

The wordmark renders in `#F9FAFB` (near-white) on dark backgrounds and in
`#0F2D2D` (dark teal) on light backgrounds.

### Clearspace

Maintain clearspace equal to the cap-height of the "D" on all four sides of
the full lockup. Never crowd the logo with interface elements or imagery.

---

## Color Palette

### Primary Colors

| Name | Hex | Role |
|---|---|---|
| Teal | `#14B8A6` | Primary accent — interactive elements, active states, on-the-clock indicator |
| Deep Teal | `#0D9488` | Hover and pressed states for teal elements; secondary buttons |
| Dark Teal | `#0F2D2D` | Primary dark background; navbar; draft room backdrop |
| Near-Black | `#111827` | Page background; card backgrounds on light themes |
| Gray | `#6B7280` | Secondary text; disabled states; placeholders; dividers |
| Off-White | `#F9FAFB` | Primary text on dark backgrounds; input backgrounds on dark UI |

### Color Intent

Teal (`#14B8A6`) is the **single active-state color**. It appears on:
- The team currently on the clock
- Selected players and active picks
- Primary action buttons
- Focus rings and interactive highlights
- Progress indicators and timers

Do not introduce a second accent color. Teal carries all urgency and
interactivity. Everything else is neutral.

### Accessible Contrast

- `#14B8A6` on `#0F2D2D`: passes AA for large text and UI components.
  Verify AA for body text before use; prefer `#F9FAFB` for body copy.
- `#F9FAFB` on `#111827`: passes AAA.
- `#6B7280` on `#0F2D2D`: passes AA for large text only; do not use for
  small body copy on dark backgrounds.

---

## Typography

### Logo and Display Headings

**Sora** (Bold or ExtraBold weight). Use for the wordmark, page-level headings
(`h1`), and any marketing or landing surface. Sora has geometric terminals and
a confident upright stance that reads as modern and direct.

Load from Google Fonts or self-host. Subset to Latin characters only for
performance.

### Application UI

**Inter** (system fallback: `ui-sans-serif, system-ui, -apple-system`) for all
interface text — labels, picks, team names, player names, body copy, buttons,
inputs. Inter is optimized for screen readability at small sizes and is
available on most platforms as a system font.

Do not use Sora in the draft board or data-dense UI. Reserve it for identity
surfaces only.

### Type Scale (suggested, not enforced)

| Level | Font | Weight | Use |
|---|---|---|---|
| Display | Sora | 800 | Page hero, landing |
| H1 | Sora | 700 | Section titles |
| H2–H3 | Inter | 600 | Card headers, panel titles |
| Body | Inter | 400 | Descriptions, labels |
| Small / Meta | Inter | 400 | Timestamps, pick metadata |
| Mono | System mono | 400 | Join codes, IDs |

---

## Usage by Surface

### App Icon and Favicon

- Shield mark only, no wordmark.
- Teal (`#14B8A6`) crown and shield stroke on Dark Teal (`#0F2D2D`) background.
- At 16×16 (favicon): reduce stroke weight; crown may simplify to a single point.
- At 1024×1024 (App Store / marketing): full detail, no border radius applied
  at the source — let the platform apply its own mask.

### Navbar

- Background: Dark Teal (`#0F2D2D`).
- Logo lockup (mark + wordmark) in Off-White (`#F9FAFB`).
- Navigation links in Gray (`#6B7280`), active link in Off-White.
- Primary CTA button (e.g., "Create Draft") in Teal with white label.
- On mobile collapse: mark only, same colors.

### Buttons

| Variant | Background | Label | Hover |
|---|---|---|---|
| Primary | `#14B8A6` | `#0F2D2D` | `#0D9488` |
| Secondary | transparent, `#14B8A6` border | `#14B8A6` | `#0D9488` border + label |
| Destructive | `#EF4444` (red) | `#F9FAFB` | darker red |
| Disabled | `#374151` | `#6B7280` | no change |

Do not use teal for destructive actions. Red is reserved for remove, delete,
and irreversible operations only.

### Draft Room

The draft room is the product's highest-stakes surface. Keep it dark and
focused.

- Board background: Near-Black (`#111827`).
- Pick cells: `#1F2937` (slightly elevated surface).
- On-the-clock row or column: Teal left-border accent + subtle teal tint
  (`#14B8A6` at 10% opacity) on the cell background.
- Completed picks: Gray label (`#6B7280`); reduce visual weight so the active
  slot reads clearly.
- Timer: Teal numerals while time remains; shift to red when expired.
- Commissioner controls: secondary button style (teal outline); never primary
  fill — they are recovery tools, not the default action.

### League Pages (Milestone 4B+)

League pages inherit the same dark-mode foundation. League branding (custom
colors, logo) overlays on top of the base palette using a theme layer.

- League primary color is applied to the league header/banner area only.
- Draft room always uses the DraftHQ base palette regardless of league theme,
  ensuring consistency across all drafts.
- If a league's custom color conflicts with readable contrast, the UI falls
  back to teal.

---

## What Not to Do

- Do not use teal as a background fill for large areas. It is an accent only.
- Do not render the wordmark in teal. Use Off-White on dark or Dark Teal on
  light backgrounds only.
- Do not introduce gradients on the shield mark. Flat color only.
- Do not use Sora for body copy or data-dense UI — it is for identity and
  display only.
- Do not use light backgrounds in the draft room. The draft room is always dark.
- Do not use a second accent color alongside teal for interactive states. Teal
  is the sole action color.
- Do not scale the logo below the minimum legible size for the wordmark
  (~120px wide for the full lockup). Use the mark alone below that threshold.
- Do not apply drop shadows or glows to the shield mark in product UI. Shadows
  are acceptable in marketing contexts only.
- Do not modify the crown-to-shield proportions or detach the crown from the
  shield shape.
