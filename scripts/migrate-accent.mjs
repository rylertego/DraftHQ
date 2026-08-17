// One-shot migration: hardcoded teal -> accent tokens.
//
// Two decisions drive this, and neither is a plain find-and-replace:
//
//   1. Scope. Anything rendered inside a league takes --color-league-accent so
//      a league that chose its own colour keeps it. Everything else takes
//      --color-product-accent. (--color-league-accent already falls back to the
//      product accent, so league-scoped files are safe outside a league too.)
//
//   2. Not every teal is brand. The confirmation banners are success styling
//      that merely happened to match the old accent. They become success
//      tokens; turning them cyan would make every "Saved!" read as brand.
//
// emailTemplates.ts is deliberately excluded: mail clients have no CSS
// variables, so inline hex is correct there and only its value changes.

import { readFileSync, writeFileSync } from "node:fs";

const LEAGUE_FILES = [
  "src/app/draft/DraftRoom.tsx",
  "src/components/DraftChat.tsx",
  "src/components/DraftBoard.tsx",
  "src/components/DraftLobby.tsx",
  "src/components/DraftTicker.tsx",
  "src/components/DraftAwardsCeremony.tsx",
  "src/components/DraftOrderRace.tsx",
  "src/components/DraftGradesBoard.tsx",
  "src/components/LeagueWorkspaceHeader.tsx",
  "src/components/LeagueCommandCenter.tsx",
  "src/app/teams/TeamSetupForm.tsx",
];

const PRODUCT_FILES = [
  "src/app/dashboard/page.tsx",
  "src/app/signup/page.tsx",
  "src/app/profile/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/reset-password/page.tsx",
  "src/app/login/page.tsx",
  "src/app/create/page.tsx",
  "src/app/join/JoinDraftForm.tsx",
  "src/app/leagues/new/page.tsx",
];

// Tailwind arbitrary values cannot carry a /opacity suffix on a var(), so
// translucent shades go through color-mix. Underscores stand in for spaces.
const mix = (token, pct) =>
  `color-mix(in_srgb,var(${token})_${pct}%,transparent)`;

function rules(scope) {
  const A = `--color-${scope}-accent`;
  const HOVER = `--color-${scope}-accent-hover`;
  const BORDER = `--color-${scope}-accent-border`;
  const MUTED = `--color-${scope}-accent-muted`;

  return [
    // Translucent variants first — the bare-shade rules would otherwise eat
    // the colour half and strand the "/20".
    [/\bbg-teal-500\/30\b/g, `bg-[${mix(A, 30)}]`],
    [/\bbg-teal-500\/20\b/g, `bg-[${mix(A, 20)}]`],
    [/\bbg-teal-500\/10\b/g, `bg-[${mix(A, 10)}]`],
    [/\bborder-teal-500\/60\b/g, `border-[${mix(BORDER, 60)}]`],
    [/\bborder-teal-500\/50\b/g, `border-[${mix(BORDER, 50)}]`],
    [/\bborder-teal-500\/40\b/g, `border-[${mix(BORDER, 40)}]`],
    [/\bborder-teal-500\/30\b/g, `border-[${mix(BORDER, 30)}]`],
    // Deep tinted surfaces read as backdrop, not accent.
    [/\bbg-teal-950\/30\b/g, `bg-[${mix(MUTED, 30)}]`],
    [/\bbg-teal-950\/20\b/g, `bg-[${mix(MUTED, 20)}]`],
    [/\bbg-teal-900\/60\b/g, `bg-[${mix(MUTED, 60)}]`],

    // Solid fills. 400/600 appear as the hover partner of 500.
    [/\bhover:bg-teal-400\b/g, `hover:bg-[var(${HOVER})]`],
    [/\bhover:bg-teal-600\b/g, `hover:bg-[var(${HOVER})]`],
    [/\bbg-teal-400\b/g, `bg-[var(${HOVER})]`],
    [/\bbg-teal-600\b/g, `bg-[var(${HOVER})]`],
    [/\bbg-teal-500\b/g, `bg-[var(${A})]`],

    // Text.
    [/\bhover:text-teal-300\b/g, `hover:text-[color:var(${HOVER})]`],
    [/\bhover:text-teal-200\b/g, `hover:text-[color:var(${HOVER})]`],
    [/\btext-teal-200\b/g, `text-[color:var(${HOVER})]`],
    [/\btext-teal-300\b/g, `text-[color:var(${A})]`],
    [/\btext-teal-400\b/g, `text-[color:var(${A})]`],
    [/\btext-teal-500\b/g, `text-[color:var(${A})]`],

    // Borders and form controls.
    [/\bborder-teal-800\b/g, `border-[color:var(${BORDER})]`],
    [/\bborder-teal-600\b/g, `border-[color:var(${BORDER})]`],
    [/\bborder-teal-500\b/g, `border-[color:var(${BORDER})]`],
    [/\baccent-teal-500\b/g, `accent-[var(${A})]`],

    // Hex literals of the old brand teal.
    [/#14[Bb]8[Aa]6/g, `var(${A})`],
    [/#14[Bb][Bb][Aa]6/g, `var(${A})`],
    [/#0[Dd]9488/g, `var(${BORDER})`],
    [/#2[Dd][Dd]4[Bb][Ff]/g, `var(${HOVER})`],
  ];
}

// The confirmation banners: teal that means "it worked", not "brand".
const SUCCESS_RULES = [
  [/\bborder-teal-800\b/g, "border-[color:var(--color-success-border)]"],
  [/\bbg-teal-950\/30\b/g, "bg-[color-mix(in_srgb,var(--color-success-muted)_45%,transparent)]"],
  [/\btext-teal-300\b/g, "text-[color:var(--color-success-border)]"],
  [/\btext-teal-400\b/g, "text-[color:var(--color-success-border)]"],
];

function migrate(path, scope) {
  const before = readFileSync(path, "utf8");
  const lines = before.split("\n");
  const scopeRules = rules(scope);

  const after = lines
    .map((line) => {
      // A line carrying the banner border is a success surface; its other teal
      // tokens belong to the same banner.
      const isSuccess = /border-teal-800\b/.test(line);
      const applied = isSuccess ? SUCCESS_RULES : scopeRules;
      let out = line;
      for (const [re, to] of applied) out = out.replace(re, to);
      return out;
    })
    .join("\n");

  if (after !== before) {
    writeFileSync(path, after);
    const left = (after.match(/teal-[0-9]/g) || []).length;
    console.log(`${scope.padEnd(7)} ${path}${left ? `  (${left} left)` : ""}`);
  }
}

for (const f of LEAGUE_FILES) migrate(f, "league");
for (const f of PRODUCT_FILES) migrate(f, "product");
