# DraftHQ

DraftHQ is a private, invite-only multiplayer fantasy football draft room. It
uses Next.js, TypeScript, Tailwind CSS, Supabase, and Vitest.

The current target is a reliable live draft for a 10-12 person league by
September 2, 2026. The release question is:

> Can my league complete its September 2 draft in DraftHQ without needing
> FanDraft?

## Current Focus

* Supabase-backed multiplayer state
* Realtime and atomic picks
* Team ownership and email invitations
* Searchable player database
* Draft timer
* Commissioner controls and undo
* Persistence and recovery
* Mobile draft-day reliability

Sleeper import, league colors and logo, team logos, and basic themes are
high-priority stretch goals. Spotify, YouTube, walk-up songs, sounds, broadcast
polish, animations, and AI are lower-priority roadmap items and must not block
the required workflow.

## Local Development

1. Copy `.env.example` to `.env.local` and configure the Supabase values.
2. Apply the versioned migrations in `supabase/migrations` to the Supabase
   project.
3. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See [docs/supabase-setup.md](docs/supabase-setup.md) for Supabase configuration
and [docs/product-vision.md](docs/product-vision.md) for product scope.

## Verification

```bash
npm test -- --run
npm run lint
npm run build
```

The live multiplayer harness requires a configured `.env.local`:

```bash
npm run test:multiplayer
```

## Product Boundaries

DraftHQ starts private for one league. Reliability and draft correctness take
priority over public growth or presentation features. Long-term plans include
Sleeper integration, league and team customization, music integrations, and a
broadcast-style TV mode.
