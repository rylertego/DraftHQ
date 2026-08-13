import type { RosterPosition } from "@/types/draft";

// Canonical roster slot definitions. `min` is the number of required starters
// at that slot and `max` is the cap; a league that has never been configured
// leaves every min at 0, which means "no declared starting lineup".
export const DEFAULT_ROSTER_POSITIONS: RosterPosition[] = [
  { id: "QB", label: "Quarterbacks", abbrev: "QB", enabled: true, min: 0, max: 9, color: "#67E8F9" },
  { id: "RB", label: "Running backs", abbrev: "RB", enabled: true, min: 0, max: 9, color: "#FCD34D" },
  { id: "WR", label: "Wide Receivers", abbrev: "WR", enabled: true, min: 0, max: 9, color: "#F97316" },
  { id: "TE", label: "Tight End", abbrev: "TE", enabled: true, min: 0, max: 9, color: "#A78BFA" },
  { id: "K", label: "Kickers", abbrev: "K", enabled: true, min: 0, max: 9, color: "#4ADE80" },
  { id: "DST", label: "Defense / ST", abbrev: "Def", enabled: true, min: 0, max: 9, color: "#F87171" },
  { id: "IDP", label: "Individual Def. Players", abbrev: "IDP", enabled: false, min: 0, max: 9, color: "#C4A4A4" },
  { id: "FLEX", label: "Flex (W/R/T)", abbrev: "FLX", enabled: false, min: 0, max: 9, color: "#94A3B8" },
  { id: "SUPERFLEX", label: "Superflex (Q/W/R/T)", abbrev: "SF", enabled: false, min: 0, max: 9, color: "#818CF8" },
  { id: "OP", label: "Offensive Player", abbrev: "OP", enabled: false, min: 0, max: 9, color: "#FCA5A5" },
  { id: "DL", label: "Defensive Line", abbrev: "DL", enabled: false, min: 0, max: 9, color: "#86EFAC" },
  { id: "LB", label: "Linebacker", abbrev: "LB", enabled: false, min: 0, max: 9, color: "#93C5FD" },
  { id: "DB", label: "Defensive Back", abbrev: "DB", enabled: false, min: 0, max: 9, color: "#FDE68A" },
  { id: "BN", label: "Bench", abbrev: "BN", enabled: false, min: 0, max: 9, color: "#475569" },
  { id: "IR", label: "Injured Reserve", abbrev: "IR", enabled: false, min: 0, max: 9, color: "#7F1D1D" },
];

/** True when a commissioner (or an import) has declared an actual starting
 * lineup. Without one, need-based grading has nothing to anchor to. */
export function hasDeclaredLineup(positions: RosterPosition[] | null): boolean {
  return !!positions?.some((p) => p.enabled && p.min > 0);
}
