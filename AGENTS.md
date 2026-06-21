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