# DraftHQ Agent Instructions

## Product Direction

DraftHQ is a fantasy draft and league-experience platform. It is not just a draft board.

Primary goal:
Reliable multiplayer draft room first.

Do not prioritize music, themes, animations, AI, or league history until the core draft flow is stable.

## Current Priority

1. Realtime multiplayer reliability
2. Team ownership
3. Timer synchronization
4. Sleeper import
5. Commissioner controls
6. Mobile support

## Technical Rules

- Keep draft correctness in Supabase/Postgres when possible.
- React should display state, not enforce core draft rules.
- Do not expose service role keys.
- Do not use localStorage as authoritative draft state.
- Preserve tests.
- Run `npm test` and `npm run build` before considering work complete.

## Product Rules

- Commissioner can edit all teams/settings.
- Assigned owner can edit only their own team profile.
- Sleeper/music/customization are roadmap items unless explicitly requested.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **DraftHQ** (2435 symbols, 5153 relationships, 194 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/DraftHQ/context` | Codebase overview, check index freshness |
| `gitnexus://repo/DraftHQ/clusters` | All functional areas |
| `gitnexus://repo/DraftHQ/processes` | All execution flows |
| `gitnexus://repo/DraftHQ/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
